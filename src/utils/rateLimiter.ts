const RATE_LIMIT = Number(import.meta.env.VITE_VISIT_RATE_LIMIT) || 30000;

class UrlRateLimiter {
    private lastVisitTime: Map<string, number> = new Map();

    canAdd(url: string): boolean {
        const now = Date.now();
        const lastTime = this.lastVisitTime.get(url);
        console.log(url, lastTime, RATE_LIMIT);

        if (!lastTime || now - lastTime >= RATE_LIMIT) {
            console.log("Can add to queue")
            this.lastVisitTime.set(url, now);
            return true;
        }

        return false;
    }

    cleanup(): void {
        const now = Date.now();
        for (const [url, timestamp] of this.lastVisitTime.entries()) {
            if (now - timestamp >= RATE_LIMIT) {
                this.lastVisitTime.delete(url);
            }
        }
    }
}

export const urlRateLimiter = new UrlRateLimiter();

setInterval(() => urlRateLimiter.cleanup(), 60000);

