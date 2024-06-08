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
