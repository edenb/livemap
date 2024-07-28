import { io } from 'socket.io-client';

export function createLiveClient(serverUrl, token, cookie, onData) {
    return new Promise(function (resolve, reject) {
        let options = { forceNew: true };
        if (cookie) {
            options = { ...options, ...{ extraHeaders: { cookie } } };
        }

        const socket = io(serverUrl, options);
        socket.on('positionUpdate', function (data) {
            onData(data);
        });
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
