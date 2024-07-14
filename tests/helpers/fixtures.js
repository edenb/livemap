export const adm1Auth = {
    password: 'password-adm1',
};

export const adm1 = {
    username: 'adm1',
    fullname: 'Admin 1',
    email: 'admin1@example.com',
    role: 'admin',
    api_key: 'apikey-adm1',
};

export const adm1Devs = [
    {
        api_key: 'apikey-adm1',
        identifier: 'adm1Dev1',
        alias: 'Admin 1 device 1',
    },
    {
        api_key: 'apikey-adm1',
        identifier: 'adm1Dev2',
        alias: 'Admin 1 device 2',
    },
];

export const man1Auth = {
    password: 'password-man1',
};

export const man1 = {
    username: 'man1',
    fullname: 'Manager 1',
    email: 'manager1@example.com',
    role: 'manager',
    api_key: 'apikey-man1',
};

export const man1Devs = [
    {
        api_key: 'apikey-man1',
        identifier: 'man1Dev1',
        alias: 'Manager 1 device 1',
    },
    {
        api_key: 'apikey-man1',
        identifier: 'man1Dev2',
        alias: 'Manager 1 device 2',
    },
];

export const vwr1Auth = {
    password: 'password-vwr1',
};

export const vwr1 = {
    username: 'vwr1',
    fullname: 'Viewer 1',
    email: 'viewer1@example.com',
    role: 'viewer',
    api_key: 'apikey-vwr1',
};

export const vwr1Devs = [
    {
        api_key: 'apikey-vwr1',
        identifier: 'vwr1Dev1',
        alias: 'Viewer 1 device 1',
    },
    {
        api_key: 'apikey-vwr1',
        identifier: 'vwr1Dev2',
        alias: 'Viewer 1 device 2',
    },
];

export const vwr2Auth = {
    password: 'password-vwr2',
};

export const vwr2 = {
    username: 'vwr2',
    fullname: 'Viewer 2',
    email: 'viewer2@example.com',
    role: 'viewer',
    api_key: 'apikey-vwr2',
};

export const vwr2Devs = [
    {
        api_key: 'apikey-vwr2',
        identifier: 'vwr2Dev1',
        alias: 'Viewer 2 device 1',
    },
];

export const vwr3Auth = {
    password: 'password-vwr3',
};

export const vwr3 = {
    username: 'vwr3',
    fullname: 'Viewer 3',
    email: 'viewer3@example.com',
    role: 'viewer',
    api_key: 'apikey-vwr3',
};

export const vwr3Devs = [
    {
        api_key: 'apikey-vwr3',
        identifier: 'vwr3Dev1',
        alias: 'Viewer 3 device 1',
    },
];

export const devPositions = [
    {
        device_id: null,
        device_id_tag: null,
        loc_timestamp: '2019-01-01T00:00:00.000Z',
        loc_lat: 40.1,
        loc_lon: -73.1,
        loc_type: null,
        loc_attr: null,
    },
];

export const mqttMessage =
    '{"id":"vwr1Dev1", "apikey":"apikey-vwr1", "timestamp":"2024-05-10T15:14:31.191Z", "lat":"32.123", "lon":"-110.123"}';

export const mqttMessageProcessed = {
    api_key: 'apikey-vwr1',
    identifier: 'vwr1Dev1',
    device_id_tag: null,
    identifier_tag: null,
    api_key_tag: null,
    alias: 'vwr1Dev1',
    loc_timestamp: '2024-05-10T15:14:31.191Z',
    loc_lat: 32.123,
    loc_lon: -110.123,
    loc_type: null,
    loc_attr: undefined,
};

export const gpxMessage =
    'device_id=apikey-vwr1_vwr1Dev1&gps_latitude=40.7579747&gps_longitude=-73.9855426&gps_time=2019-01-01T00%3A00%3A00.000Z';

export const gpxMessageProcessed = {
    api_key: 'apikey-vwr1',
    identifier: 'vwr1Dev1',
    alias: 'vwr1Dev1',
    device_id_tag: null,
    api_key_tag: null,
    identifier_tag: null,
    loc_timestamp: '2019-01-01T00:00:00.000Z',
    loc_lat: 40.7579747,
    loc_lon: -73.9855426,
    loc_type: 'rec',
    loc_attr: null,
};

export const locDevMessage =
    'device=apikey-vwr1-ABCD-1234-ABCD-123456789ABC&device_model=iPad5%2C4&device_type=iOS&id=apikey-vwr1&latitude=40.7579747&longitude=-73.9855426&timestamp=1566486660.187957&trigger=enter';

export const locDevMessageProcessed = {
    api_key: 'apikey-vwr1',
    device_id_tag: null,
    alias: 'apikey-vwr1-ABCD-1234-ABCD-123456789ABC',
    loc_timestamp: '2019-08-22T15:11:00.187Z',
    loc_lat: 40.7579747,
    loc_lon: -73.9855426,
    loc_attr: null,
    loc_type: 'now',
};

export const locTagMessage =
    'device=apikey-vwr1-ABCD-1234-ABCD-123456789ABC&device_model=iPad5%2C4&device_type=iOS&id=apikey-vwr1:tag1&latitude=0&longitude=0&timestamp=1571508472.691251&trigger=enter';

export const locTagMessageProcessed = {
    loc_timestamp: '2019-10-19T18:07:52.691Z',
    api_key: 'apikey-vwr1',
    alias: 'tag1',
    loc_lat: 0,
    loc_lon: 0,
    loc_attr: null,
    loc_type: 'now',
};
