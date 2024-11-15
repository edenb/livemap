export function createWebServer(app, port) {
    return new Promise(function (resolve) {
        const server = app.listen(port, function () {
            resolve(server);
        });
    });
}

export function destroyWebServer(server) {
    return new Promise(function (resolve) {
        server.close(function () {
            resolve();
        });
    });
}

export function addRoutes(app, basePath, router) {
    app.use(basePath, router);
}
