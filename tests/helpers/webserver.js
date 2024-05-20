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

export function addRouter(app, baseRoute, router) {
    app.use(baseRoute, router);
}
