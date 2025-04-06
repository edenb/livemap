export function forceHttps(enabled) {
    return (req, res, next) => {
        if (enabled && !req.secure) {
            res.redirect(301, `https://${req.headers.host}${req.url}`);
        } else {
            next();
        }
    };
}
