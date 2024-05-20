import { expect } from 'chai';
import { queryDbAsync } from '../src/database/db.js';

const testUser = {
    username: 'testuser1',
    fullName: 'Test User1',
    email: 'test@user1',
    role: 'user',
    api_key: '12345678',
    password: 'testuser1',
};

let testUser_Id = null;

describe('Database', function () {
    describe('#getNumberOfTables', function () {
        it('should respond with 5 as the number of tables', async function () {
            const queryRes = await queryDbAsync('getNumberOfTables', []);
            expect(queryRes.rowCount).to.equal(1);
            expect(queryRes.rows[0].count).to.equal('5');
        });
    });

    describe('#getUserByUsername', function () {
        it('should respond with no errors', async function () {
            const queryRes = await queryDbAsync('getUserByUsername', [
                testUser.username,
            ]);
            if (queryRes.rowCount > 0) {
                testUser_Id = queryRes.rows[0].user_id;
            } else {
                testUser_Id = null;
            }
        });
    });

    describe('#deleteUser', function () {
        it('should respond with no errors', async function () {
            const queryRes = await queryDbAsync('deleteUser', [testUser_Id]);
            if (testUser_Id === null) {
                expect(queryRes.rowCount).to.equal(0);
            } else {
                expect(queryRes.rowCount).to.equal(1);
            }
        });
    });

    describe('#insertUser', function () {
        it('should create 1 user', async function () {
            const queryRes = await queryDbAsync('insertUser', [
                testUser.username,
                testUser.fullName,
                testUser.email,
                testUser.role,
                testUser.api_key,
                testUser.password,
            ]);
            expect(queryRes.rowCount).to.equal(1);
        });
    });

    describe('#getUserByUsername', function () {
        it('should return 1 user', async function () {
            const queryRes = await queryDbAsync('getUserByUsername', [
                testUser.username,
            ]);
            if (queryRes.rowCount > 0) {
                testUser_Id = queryRes.rows[0].user_id;
            } else {
                testUser_Id = null;
            }
            expect(queryRes.rowCount).to.equal(1);
        });
    });

    describe('#deleteUser', function () {
        it('should delete 1 user', async function () {
            const queryRes = await queryDbAsync('deleteUser', [testUser_Id]);
            expect(queryRes.rowCount).to.equal(1);
        });
    });
});
