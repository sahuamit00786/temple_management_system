export default function StatCard({ icon: Icon, label, value, sub, accent = 'saffron', onClick }) {
  const ring = { saffron: 'bg-saffron-100 text-saffron-600', leaf: 'bg-leaf-600/10 text-leaf-700', kumkum: 'bg-kumkum-500/10 text-kumkum-600', gold: 'bg-gold-300/30 text-gold-500' }[accent];
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`card p-4 flex items-start gap-3 text-left w-full ${onClick ? 'cursor-pointer transition hover:shadow-md hover:border-gold-400/70' : ''}`}
    >
      <div className={`p-2.5 rounded-full ring-1 ring-gold-300/60 ${ring}`}><Icon size={20} /></div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-600">{label}</p>
        <p className="text-2xl font-display text-maroon-900 leading-tight tabular-nums">{value}</p>
        {sub && <p className="text-xs text-ink-600 mt-0.5">{sub}</p>}
      </div>
    </Tag>
  );
}
