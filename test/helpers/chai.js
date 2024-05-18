// This helper is a workaround for an issue with Chai and the chai-http plugin.
// At the moment Chai plugins can only be registered ones with the use() function.
// This helper instantiates Chai with chai-http extension and provides a requester
// for all tests to use.
// Issue: https://github.com/chaijs/chai/issues/1603
import { use } from 'chai';
import chaiHttp from 'chai-http';

const { request } = use(chaiHttp);

export default request;
