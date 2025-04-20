export function unless(middleware, ...paths) {
    return (req, res, next) => {
        const pathCheck = paths.some((path) => req.path.includes(path));
        pathCheck ? next() : middleware(req, res, next);
    };
}
