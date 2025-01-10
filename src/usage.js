class CursorAPI {
    constructor(jwtToken) {
        this.jwtToken = jwtToken;
        this.payload = this.decodeJWT(jwtToken);
        this.userId = this.payload.sub.split('|')[1];
    }

    decodeJWT(token) {
        const [, base64Url] = token.split('.');
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(atob(base64));
    }

    async getUsage() {
        try {
            const response = await fetch(
                `https://www.cursor.com/api/usage?user=${this.userId}`, {
                    headers: {
                        Cookie: `WorkosCursorSessionToken=${this.userId}::${this.jwtToken}`
                    }
                }
            );

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            return { error: error.message };
        }
    }
}
module.exports = {
    CursorAPI
};
// 使用示例
// const cursor = new CursorAPI('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhdXRoMHx1c2VyXzAxSkdOUUFHSDNGUFYyWlNTQUJENko2NjY2IiwidGltZSI6IjE3MzU4OTU5MDUiLCJyYW5kb21uZXNzIjoiMTMxMDgxMTgtZDcxYi00M2I1IiwiZXhwIjo0MzI3ODk1OTA1LCJpc3MiOiJodHRwczovL2F1dGhlbnRpY2F0aW9uLmN1cnNvci5zaCIsInNjb3BlIjoib3BlbmlkIHByb2ZpbGUgZW1haWwgb2ZmbGluZV9hY2Nlc3MiLCJhdWQiOiJodHRwczovL2N1cnNvci5jb20ifQ.Cbi6CsMgL113QczQQMT0PZrLeRfGVO7t26CCLNz3Xyw');
// cursor.getUsage()
//     .then(console.log)
//     .catch(console.error);