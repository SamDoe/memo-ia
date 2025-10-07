export default async function healthRoutes(f) {
    f.get('/health', async () => ({ ok: true }));
}
