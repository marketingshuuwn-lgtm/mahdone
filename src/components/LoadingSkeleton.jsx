/** هيكل تحميل خفيف بدل دائرة فقط */
export default function LoadingSkeleton() {
  return (
    <div className="skel-page" aria-busy="true" aria-label="جاري التحميل">
      <div className="skel-stats">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skel-stat skel-pulse" />
        ))}
      </div>
      <div className="skel-sections">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skel-section">
            <div className="skel-section-head skel-pulse" />
            <div className="skel-row skel-pulse" />
            <div className="skel-row skel-pulse" style={{ width: '88%' }} />
            <div className="skel-row skel-pulse" style={{ width: '72%' }} />
          </div>
        ))}
      </div>
    </div>
  );
}
