import { expect } from 'chai';
import { queryDbAsync } from '../database/db.js';

const testUser = {
    username: 'testuser1',
    fullName: 'Test User1',
    email: 'test@user1',
    role: 'user',
    api_key: '12345678',
    password: 'testuser1',
};

let testUser_Id = null;

describe('Database', () => {
    describe('#getNumberOfTables', () => {
        it('should respond with 5 as the number of tables', async () => {
            try {
                const queryRes = await queryDbAsync('getNumberOfTables', []);
                expect(queryRes.rowCount).to.equal(1);
                expect(queryRes.rows[0].count).to.equal('5');
            } catch (err) {
                throw new Error(err.message);
            }
        });
    });

    describe('#getUserByUsername', () => {
        it('should respond with no errors', async () => {
            try {
                const queryRes = await queryDbAsync('getUserByUsername', [
                    testUser.username,
                ]);
                if (queryRes.rowCount > 0) {
                    testUser_Id = queryRes.rows[0].user_id;
                } else {
                    testUser_Id = null;
                }
            } catch (err) {
                throw new Error(err.message);
            }
        });
    });

    describe('#deleteUser', () => {
        it('should respond with no errors', async () => {
            try {
                const queryRes = await queryDbAsync('deleteUser', [
                    testUser_Id,
                ]);
                if (testUser_Id === null) {
                    expect(queryRes.rowCount).to.equal(0);
                } else {
                    expect(queryRes.rowCount).to.equal(1);
                }
            } catch (err) {
                throw new Error(err.message);
            }
        });
    });

    describe('#insertUser', () => {
        it('should create 1 user', async () => {
            try {
                const queryRes = await queryDbAsync('insertUser', [
                    testUser.username,
                    testUser.fullName,
                    testUser.email,
                    testUser.role,
                    testUser.api_key,
                    testUser.password,
                ]);
                expect(queryRes.rowCount).to.equal(1);
            } catch (err) {
                throw new Error(err.message);
            }
        });
    });

    describe('#getUserByUsername', () => {
        it('should return 1 user', async () => {
            try {
                const queryRes = await queryDbAsync('getUserByUsername', [
                    testUser.username,
                ]);
                if (queryRes.rowCount > 0) {
                    testUser_Id = queryRes.rows[0].user_id;
                } else {
                    testUser_Id = null;
                }
                expect(queryRes.rowCount).to.equal(1);
            } catch (err) {
                throw new Error(err.message);
            }
        });
    });

    describe('#deleteUser', () => {
        it('should delete 1 user', async () => {
            try {
                const queryRes = await queryDbAsync('deleteUser', [
                    testUser_Id,
                ]);
                expect(queryRes.rowCount).to.equal(1);
            } catch (err) {
                throw new Error(err.message);
            }
        });
    });
});
