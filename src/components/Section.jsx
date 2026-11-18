export default function Section({ index, title, detail, children }) {
  return (
    <section className="section">
      <h2 className="section-heading">
        <span className="section-index">{index}</span> {title}
        {detail && <span className="section-detail">{detail}</span>}
      </h2>
      <div className="section-content">{children}</div>
    </section>
  );
}
