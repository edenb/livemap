// This helper is a workaround for an issue with Chai and the chai-http plugin.
// At the moment Chai plugins can only be registered ones with the use() function.
// This helper instantiates Chai with chai-http extension and provides a requester
// for all tests to use.
// Issue: https://github.com/chaijs/chai/issues/1603
import { use } from 'chai';
import chaiHttp from 'chai-http';
const chai = use(chaiHttp);

export const request = chai.request.execute;

// Create a subset of an object array that only contains the given keys
// data = [ { a: 1, b: 2, c: 3 }, { a: 4, b: 5, c: 6 } ];
// subset(data, ['a', 'b']))  =>  [ { a: 1, b: 2 }, { a: 4, b: 5 } ]
export function subset(objArray, keys) {
    return objArray.map((obj) => {
        return keys.reduce((newObj, key) => {
            if (key in obj) {
                newObj[key] = obj[key];
            }
            return newObj;
        }, {});
    });
}
