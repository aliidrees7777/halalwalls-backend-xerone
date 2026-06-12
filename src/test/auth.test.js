/**
 * HalalWalls /api/v1/auth — user authentication tests.
 * Covers the happy path for signup & login plus a bad-login case.
 * (No email verification — signup/login return a JWT immediately.)
 */
const chai = require('chai');
const chaiHttp = require('chai-http');
const testDb = require('./helpers/testDb');

chai.use(chaiHttp);
const { expect } = chai;
const app = () => testDb.app();

// Asserts the standard response envelope is present on every response.
const expectEnvelope = (res, status) => {
  expect(res.body).to.include.keys(['status', 'statusCode', 'message', 'data', 'service', 'method', 'path', 'timestamp']);
  expect(res.body.status).to.equal(status);
  expect(res.body.service).to.equal('halalwalls-backend');
};

describe('POST /api/v1/auth/signup', () => {
  it('201 creates a user (role=user) + token + envelope', async () => {
    const res = await chai.request(app()).post('/api/v1/auth/signup').send({
      firstName: 'Aisha', lastName: 'Rahman', email: 'aisha@example.com', password: 'password123', confirmPassword: 'password123',
    });
    expect(res).to.have.status(201);
    expectEnvelope(res, 'success');
    expect(res.body.data.user.email).to.equal('aisha@example.com');
    expect(res.body.data.user.role).to.equal('user');
    expect(res.body.data.user).to.not.have.property('password');
    expect(res.body.data.token).to.be.a('string');
  });

  it('409 on duplicate email', async () => {
    const body = { firstName: 'Dup', email: 'dupe@example.com', password: 'password123', confirmPassword: 'password123' };
    await chai.request(app()).post('/api/v1/auth/signup').send(body);
    const res = await chai.request(app()).post('/api/v1/auth/signup').send(body);
    expect(res).to.have.status(409);
    expectEnvelope(res, 'error');
  });
});

describe('POST /api/v1/auth/login', () => {
  it('200 + token on valid credentials', async () => {
    await testDb.createUser({ email: 'good@example.com', password: 'password123' });
    const res = await chai.request(app()).post('/api/v1/auth/login').send({ email: 'good@example.com', password: 'password123' });
    expect(res).to.have.status(200);
    expectEnvelope(res, 'success');
    expect(res.body.data.token).to.be.a('string');
    expect(res.body.data.user.email).to.equal('good@example.com');
  });

  it('401 on wrong password', async () => {
    await testDb.createUser({ email: 'user@example.com', password: 'password123' });
    const res = await chai.request(app()).post('/api/v1/auth/login').send({ email: 'user@example.com', password: 'wrongpass1' });
    expect(res).to.have.status(401);
    expectEnvelope(res, 'error');
  });
});
