export function toCSV(rows) {
    if (rows.length === 0)
        return '';
    const headers = Object.keys(rows[0]);
    const esc = (v) => {
        const s = v == null ? '' : String(v);
        if (s.includes('"') || s.includes(',') || s.includes('\n')) {
            return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
    };
    const out = [headers.join(',')];
    for (const r of rows)
        out.push(headers.map(h => esc(r[h])).join(','));
    return out.join('\n');
}
