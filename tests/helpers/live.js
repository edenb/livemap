import { io } from 'socket.io-client';

export function createLiveClient(serverUrl, token, onData) {
    return new Promise(function (resolve, reject) {
        const socket = io(serverUrl);
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
