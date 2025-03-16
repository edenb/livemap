import * as chai from 'chai';
import { default as chaiHttp, request as chaiRequest } from 'chai-http';

chai.use(chaiHttp);

export const request = chaiRequest.execute;
export const agent = chaiRequest.agent;
