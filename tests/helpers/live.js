import { io } from 'socket.io-client';

export function createLiveClient(
    serverUrl,
    token,
    cookie,
    tokenInHandshake,
    onData,
) {
    return new Promise(function (resolve, reject) {
        let options = { forceNew: true };
        if (tokenInHandshake) {
            options = { ...options, ...{ auth: { token: token } } };
        }
        if (cookie) {
            options = { ...options, ...{ extraHeaders: { cookie } } };
        }

        const socket = io(serverUrl, options);
        socket.on('positionUpdate', function (data) {
            onData(data);
        });
        if (tokenInHandshake) {
            socket.on('connect', function () {
                resolve(socket);
            });
            socket.on('connect_error', function () {
                socket.close();
                reject(new Error('Unauthorized'));
            });
        } else {
            socket.on('authenticate', function () {
                socket.emit('token', token);
            });
            socket.on('authorized', function () {
                resolve(socket);
            });
            socket.on('unauthorized', function () {
                socket.close();
                reject(new Error('Unauthorized'));
            });
        }
    });
}

export function destroyLiveClient(socket) {
    return new Promise(function (resolve) {
        socket.on('disconnect', (reason, details) => {
            resolve();
        });
        socket.close();
    });
}
