const TRELLO_API = 'https://api.trello.com/1';
const FETCH_TIMEOUT_MS = 20000;

function authParams(apiKey, token) {
  return 'key=' + encodeURIComponent(apiKey) + '&token=' + encodeURIComponent(token);
}

async function trelloFetch(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      const text = await res.text();
      if (res.status === 401 || res.status === 403) {
        throw new Error(
          'مفتاح أو Token غير صالح. تأكد أنك نسخت API Key وليس Secret، وأنشأت Token من رابط التفويض.'
        );
      }
      throw new Error(text || 'خطأ تريلو ' + res.status);
    }
    return res.json();
  } catch (err) {
    if (err && err.name === 'AbortError') {
      throw new Error('انتهت مهلة الاتصال بتريلو. تحقق من الشبكة وحاول مرة أخرى.');
    }
    if (err && err.message && /Failed to fetch|NetworkError|Load failed/i.test(err.message)) {
      throw new Error('تعذر الوصول لـ api.trello.com من المتصفح. تحقق من الشبكة أو مانع الإعلانات.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** التحقق من صحة المفاتيح وإرجاع بيانات العضو */
export async function trelloTestConnection(apiKey, token) {
  return trelloFetch(
    TRELLO_API + '/members/me?' + authParams(apiKey, token) + '&fields=id,fullName,username'
  );
}

/**
 * البطاقات المفتوحة المسندة للعضو الحالي + المرفقات (روابط).
 */
export async function trelloFetchMyOpenCards(apiKey, token) {
  const fields = [
    'id',
    'name',
    'desc',
    'due',
    'dueComplete',
    'shortUrl',
    'url',
    'idBoard',
    'idList',
    'labels',
    'dateLastActivity',
    'closed',
  ].join(',');

  return trelloFetch(
    TRELLO_API +
      '/members/me/cards?' +
      authParams(apiKey, token) +
      '&filter=open&attachments=true&attachment_fields=id,name,url,bytes,mimeType,date&fields=' +
      fields
  );
}

function mapAttachments(card) {
  const list = Array.isArray(card.attachments) ? card.attachments : [];
  return list
    .map((a) => ({
      id: a.id,
      name: a.name || 'مرفق',
      url: a.url || a.bytes || null,
      mimeType: a.mimeType || null,
    }))
    .filter((a) => a.url);
}

/** تحويل بطاقة تريلو إلى حقول مهمة مهد */
export function mapTrelloCardToTaskFields(card) {
  let dueDate = '';
  if (card.due) {
    const d = new Date(card.due);
    if (!Number.isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      dueDate = y + '-' + m + '-' + day;
    }
  }

  const labelNames = (card.labels || []).map((l) => l.name).filter(Boolean);
  const attachments = mapAttachments(card);
  const notesParts = [];
  if (card.desc) notesParts.push(card.desc);
  if (labelNames.length) notesParts.push('تسميات: ' + labelNames.join('، '));
  if (attachments.length) {
    notesParts.push(
      'مرفقات تريلو:\n' +
        attachments.map((a) => '- ' + a.name + ': ' + a.url).join('\n')
    );
  }

  return {
    title: (card.name || 'بطاقة تريلو').trim(),
    notes: notesParts.join('\n\n'),
    dueDate,
    // dueComplete = تم تحديد الموعد فقط؛ الإنجاز الحقيقي عند اختفاء البطاقة من open
    completed: false,
    external_source: 'trello',
    external_id: card.id,
    external_url: card.shortUrl || card.url || null,
    external_meta: {
      boardId: card.idBoard,
      listId: card.idList,
      labels: labelNames,
      attachments,
    },
  };
}
