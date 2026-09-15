const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto').webcrypto;
const repo = path.resolve(__dirname, '..');
const ts = require(path.join(repo, 'node_modules/typescript'));

// In-memory query model: predicates really filter rows, including joined AND/OR.
// No credentials, network requests, real accounts, or database access are used.
const table = (name, fields) => Object.assign({ table: name }, Object.fromEntries(fields.map(field => [field, { field }])));
const schema = {
  serviceRequests: table('missions', ['id', 'requestKind', 'requesterExpertId', 'targetExpertId', 'createdAt', 'expertDecision', 'status']),
  requestMessages: table('messages', ['id', 'requestId', 'createdAt']),
  feedbackEntries: table('feedback', ['id', 'kind', 'requestReference', 'reference', 'createdAt']),
  artisanApplications: table('members', ['id', 'status']),
};
const drizzle = {
  eq: (a, b) => row => row[a.field] === b,
  inArray: (a, b) => row => b.includes(row[a.field]),
  and: (...parts) => row => parts.every(predicate => predicate(row)),
  or: (...parts) => row => parts.some(predicate => predicate(row)),
  desc: field => field,
};
function moduleFrom(relative, dependencies) {
  const source = fs.readFileSync(path.join(repo, relative), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, require: name => {
    if (!(name in dependencies)) throw new Error(`Unexpected import: ${name}`);
    return dependencies[name];
  }, Request, Response, crypto, console: { error() {} } }, { filename: relative });
  return exports;
}
const policy = moduleFrom('app/mission-access.ts', { 'drizzle-orm': drizzle, '../db/schema': schema });
const baseMission = (overrides = {}) => ({
  id: 101, requestKind: 'service', requesterExpertId: 11, targetExpertId: 22,
  requesterName: 'Client', assignedArtisan: 'Shared display name', expertDecision: 'accepted',
  status: 'assigned', createdAt: 1, accessCodeHash: 'fixture-only', ...overrides,
});
function harness({ missions = [baseMission()], messages = [], feedback = [], member = 11, status = 'account_only', notificationFails = false, members = [{ id: 11, status: 'account_only' }, { id: 22, status: 'accepted', name: 'Fixture Expert', trade: 'Plomberie' }], routePath = 'app/api/expert/messages/route.ts' } = {}) {
  const rows = { missions: structuredClone(missions), messages: structuredClone(messages), feedback: structuredClone(feedback), members: structuredClone(members) };
  const actions = { transactions: 0, locks: [], notifications: [], inserted: [], updates: [], notificationsInsideTransaction: 0 };
  let transactionDepth = 0, trackingSequence = 0;
  const getContext = async () => member === null ? null : { account: { id: 77 }, expert: { id: member, status, name: 'Shared display name', phone: 'fixture-phone', area: 'Fixture city' } };
  const notify = async notification => {
    actions.notifications.push(notification);
    if (transactionDepth) actions.notificationsInsideTransaction++;
    if (notificationFails) throw new Error('fixture');
  };
  const db = {
    select() {
      let source, predicate = () => true, ordering = [];
      const query = {
        from(t) { source = t.table; return query; },
        where(p) { predicate = p; return query; },
        orderBy(...keys) { ordering = keys; return query; },
        for(mode) { actions.locks.push(mode); return query; },
        async limit(count) {
          return structuredClone(rows[source].filter(predicate).sort((a, b) => {
            for (const key of ordering) { const difference = b[key.field] - a[key.field]; if (difference) return difference; }
            return 0;
          }).slice(0, count));
        },
      };
      return query;
    },
    insert(t) { return { values(value) { return { async returning() {
      const inserted = { id: rows[t.table].length + 500, createdAt: new Date(), ...value };
      rows[t.table].push(inserted); actions.inserted.push(inserted); return [inserted];
    } }; } }; },
    update(t) { return { set(value) { return { where(predicate) {
      let result;
      function apply() {
        if (!result) {
          result = rows[t.table].filter(predicate);
          result.forEach(row => { Object.assign(row, value); actions.updates.push(row.id); });
        }
        return structuredClone(result);
      }
      return { returning: async () => apply(), then: (resolve, reject) => Promise.resolve(apply()).then(resolve, reject) };
    } }; } }; },
    async transaction(callback) { actions.transactions++; transactionDepth++; try { return await callback(db); } finally { transactionDepth--; } },
  };
  const route = moduleFrom(routePath, {
    'drizzle-orm': drizzle, '../../../../db': { getDb: () => db }, '../../../../db/schema': schema,
    '../../../db': { getDb: () => db }, '../../../db/schema': schema,
    '../../../social-auth': { getExpertContext: getContext },
    '../../../notification-service': { createNotification: notify, notifyClient: async () => { throw new Error('Legacy client path unexpected'); } },
    '../../../tracking-reference': { createTrackingReference: () => `MS-fixture-${++trackingSequence}` },
    '../../../mission-access': policy,
    '../../admin-access': { getAdminApiUser: async () => null },
    '../../social-auth': { getExpertContext: getContext },
    '../../notification-service': { createNotification: notify },
  });
  return { ...route, rows, actions };
}
const post = (h, body) => h.POST(new Request('http://local.invalid/api/expert/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
const requestHarness = options => harness({ member: 22, status: 'accepted', routePath: 'app/api/expert/requests/route.ts', ...options });
const patch = (h, body) => h.PATCH(new Request('http://local.invalid/api/expert/requests', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
const feedbackHarness = options => harness({ routePath: 'app/api/feedback/route.ts', missions: [baseMission({ status: 'completed', reference: 'MS-101', customerName: 'Fixture Client', customerPhone: 'fixture-phone' })], ...options });
const review = (h, body = {}) => post(h, { kind: 'review', requestId: 101, rating: 5, details: 'Service bien réalisé.', ...body });
const serviceHarness = options => harness({ routePath: 'app/api/expert/service-request/route.ts', missions: [], ...options });
const newMission = (h, body = {}) => post(h, { targetExpertId: 22, details: 'Réparer la fuite du robinet.', ...body });

test('policy authorizes only stable participant IDs of service missions', () => {
  const mission = baseMission();
  assert.equal(policy.isMissionParticipant(mission, 11), true);
  assert.equal(policy.isMissionParticipant(mission, 22), true);
  assert.equal(policy.isMissionParticipant(mission, 33), false);
  assert.equal(policy.isMissionParticipant(baseMission({ targetExpertId: null }), 22), false);
  assert.equal(policy.isMissionParticipant(baseMission({ requestKind: 'conversation' }), 11), false);
  assert.equal(policy.ownedServiceMissions(22)(mission), true);
  assert.equal(policy.ownedServiceMissions(33)(mission), false);
  assert.equal(policy.ownedServiceMissions(22)(baseMission({ targetExpertId: null })), false);
});
test('policy preserves accepted completed history but makes it read-only', () => {
  for (const status of ['assigned', 'in_progress']) {
    assert.equal(policy.hasMissionConversation(baseMission({ status })), true);
    assert.equal(policy.canSendMissionMessage(baseMission({ status })), true);
  }
  assert.equal(policy.hasMissionConversation(baseMission({ status: 'completed' })), true);
  assert.equal(policy.canSendMissionMessage(baseMission({ status: 'completed' })), false);
  for (const overrides of [{ requesterExpertId: null }, { targetExpertId: null }, { requesterExpertId: null, targetExpertId: null }]) {
    assert.equal(policy.hasMissionConversation(baseMission(overrides)), false);
    assert.equal(policy.canSendMissionMessage(baseMission(overrides)), false);
  }
  for (const overrides of [{ expertDecision: 'pending' }, { expertDecision: 'declined' }, { status: 'cancelled' }, { status: 'new' }, { requestKind: 'conversation' }]) {
    assert.equal(policy.hasMissionConversation(baseMission(overrides)), false);
    assert.equal(policy.canSendMissionMessage(baseMission(overrides)), false);
  }
  assert.equal('accessCodeHash' in policy.withoutAccessCode(baseMission()), false);
});
test('GET denies anonymous access', async () => {
  const h = harness({ member: null }); assert.equal((await h.GET()).status, 401);
});
test('GET lists only owned service missions and accepted conversation history, strips private code', async () => {
  const missions = [baseMission(), baseMission({ id: 102, expertDecision: 'pending' }), baseMission({ id: 103, requesterExpertId: 44, targetExpertId: 33 }), baseMission({ id: 104, requestKind: 'conversation' }), baseMission({ id: 105, status: 'completed' }), baseMission({ id: 106, status: 'cancelled' })];
  const messages = missions.map(m => ({ id: m.id + 100, requestId: m.id, createdAt: m.id, body: `fixture-${m.id}` }));
  const h = harness({ missions, messages }); const response = await h.GET(); const body = await response.json();
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(body.requests.map(r => r.id).sort(), [101, 102, 105, 106]);
  assert.deepEqual(body.messages.map(m => m.requestId), [101, 105]);
  assert.ok(body.requests.every(r => !('accessCodeHash' in r)));
});
test('GET provider cannot read a same-name expert mission or a legacy name-only assignment', async () => {
  const h = harness({ member: 22, missions: [baseMission(), baseMission({ id: 102, requesterExpertId: 33, targetExpertId: 44 }), baseMission({ id: 103, targetExpertId: null })], messages: [{ id: 1, requestId: 102 }, { id: 2, requestId: 103 }] });
  const body = await (await h.GET()).json(); assert.deepEqual(body.requests.map(r => r.id), [101]); assert.deepEqual(body.messages, []);
});
test('POST denies anonymous access and arbitrary new-person chat creation', async () => {
  assert.equal((await post(harness({ member: null }), { requestId: 101, content: 'Bonjour' })).status, 401);
  const h = harness(); assert.equal((await post(h, { targetExpertId: 22, content: 'Bonjour' })).status, 400); assert.equal(h.actions.inserted.length, 0);
});
test('POST validates mission ID and body without writes', async () => {
  for (const body of [{ requestId: -1, content: 'Bonjour' }, { requestId: 1.5, content: 'Bonjour' }, { requestId: 101, content: ' ' }, { requestId: 101, content: 'x'.repeat(601) }]) {
    const h = harness(); assert.equal((await post(h, body)).status, 400); assert.equal(h.actions.transactions, 0);
  }
});
test('POST rejects third party, same-name account, and missing mission', async () => {
  for (const setup of [{ member: 33 }, { missions: [] }, { member: 22, missions: [baseMission({ targetExpertId: null })] }]) {
    const h = harness(setup); assert.equal((await post(h, { requestId: 101, content: 'Bonjour' })).status, 403);
    assert.equal(h.actions.inserted.length, 0); assert.equal(h.actions.notifications.length, 0); assert.deepEqual(h.actions.locks, ['update']);
  }
});
test('POST rejects pending, declined, cancelled, completed, and legacy direct chats', async () => {
  for (const overrides of [{ expertDecision: 'pending' }, { expertDecision: 'declined' }, { status: 'cancelled' }, { status: 'completed' }, { requestKind: 'conversation' }]) {
    const h = harness({ missions: [baseMission(overrides)] }); const response = await post(h, { requestId: 101, content: 'Bonjour' });
    assert.equal(response.status, overrides.requestKind ? 403 : 409); assert.equal(h.actions.inserted.length, 0); assert.equal(h.actions.notifications.length, 0);
  }
});
test('POST accepts registered client after acceptance and notifies only this expert', async () => {
  const h = harness(); const response = await post(h, { requestId: 101, content: '  Bonjour  ', senderExpertId: 33 }); const body = await response.json();
  assert.equal(response.status, 201); assert.equal(body.message.body, 'Bonjour'); assert.equal(body.message.senderExpertId, 11); assert.equal(body.message.senderType, 'client');
  assert.equal(h.actions.transactions, 1); assert.deepEqual(h.actions.locks, ['update']); assert.equal(h.actions.notifications.length, 1); assert.equal(h.actions.notifications[0].recipientId, 22);
});
test('POST expert reply belongs to selected mission and notifies only its client', async () => {
  const h = harness({ member: 22, status: 'accepted' }); const response = await post(h, { requestId: 101, content: 'D’accord pour demain.' }); const body = await response.json();
  assert.equal(response.status, 201); assert.equal(body.message.requestId, 101); assert.equal(body.message.senderExpertId, 22); assert.equal(body.message.senderType, 'expert'); assert.equal(h.actions.notifications[0].recipientId, 11);
});
test('POST succeeds once notification delivery fails after the committed message', async () => {
  const h = harness({ notificationFails: true }); assert.equal((await post(h, { requestId: 101, content: 'Bonjour' })).status, 201); assert.equal(h.actions.inserted.length, 1);
});
test('PATCH mission acceptance is restricted to its approved target expert', async () => {
  for (const options of [{ member: 11, status: 'account_only' }, { member: 33 }, { member: null }, { missions: [baseMission({ targetExpertId: null })] }]) {
    const h = requestHarness(options); const response = await patch(h, { id: 101, action: 'accept' });
    assert.ok([403, 404].includes(response.status)); assert.equal(h.actions.updates.length, 0);
  }
});
test('PATCH pending acceptance opens precisely its conversation; second acceptance conflicts', async () => {
  const h = requestHarness({ missions: [baseMission({ expertDecision: 'pending', status: 'new' })] });
  const response = await patch(h, { id: 101, action: 'accept' }); const body = await response.json();
  assert.equal(response.status, 200); assert.equal(body.request.expertDecision, 'accepted'); assert.equal(body.request.status, 'assigned');
  assert.equal(body.conversationUrl, '/espace-expert?tab=messages&request=101'); assert.equal('accessCodeHash' in body.request, false);
  assert.equal((await patch(h, { id: 101, action: 'accept' })).status, 409); assert.equal(h.actions.updates.length, 1);
});
test('PATCH decline closes pending mission and cannot open chat', async () => {
  const h = requestHarness({ missions: [baseMission({ expertDecision: 'pending', status: 'new' })] });
  const response = await patch(h, { id: 101, action: 'decline', reason: 'Indisponible' }); const body = await response.json();
  assert.equal(response.status, 200); assert.equal(body.request.expertDecision, 'declined'); assert.equal(body.request.status, 'cancelled'); assert.equal(body.conversationUrl, undefined);
  assert.equal(policy.hasMissionConversation(body.request), false);
});
test('PATCH completion does not require a formal quote and cannot be repeated', async () => {
  const h = requestHarness({ missions: [baseMission({ quoteStatus: 'none' })] });
  const response = await patch(h, { id: 101, action: 'complete' }); const body = await response.json();
  assert.equal(response.status, 200); assert.equal(body.request.status, 'completed');
  assert.equal((await patch(h, { id: 101, action: 'complete' })).status, 409);
});
test('PATCH start allows the agreed simple flow without a mandatory formal quote', async () => {
  const h = requestHarness({ missions: [baseMission({ quoteStatus: 'none' })] });
  const response = await patch(h, { id: 101, action: 'start' });
  assert.equal(response.status, 200); assert.equal((await response.json()).request.status, 'in_progress');
});
test('PATCH acceptance remains successful when notification delivery fails', async () => {
  const h = requestHarness({ notificationFails: true, missions: [baseMission({ expertDecision: 'pending', status: 'new' })] });
  assert.equal((await patch(h, { id: 101, action: 'accept' })).status, 200); assert.equal(h.actions.updates.length, 1);
});
test('review requires a session and its mission requester; providers and third parties are denied', async () => {
  for (const [member, expected] of [[null, 401], [22, 404], [33, 404]]) {
    const h = feedbackHarness({ member }); assert.equal((await review(h)).status, expected); assert.equal(h.rows.feedback.length, 0); assert.equal(h.actions.notifications.length, 0);
  }
});
test('review is refused before accepted completion, for legacy direct chats, and unknown missions', async () => {
  for (const [overrides, expected] of [[{ status: 'new', expertDecision: 'pending' }, 409], [{ status: 'assigned' }, 409], [{ status: 'in_progress' }, 409], [{ status: 'cancelled' }, 409], [{ status: 'completed', expertDecision: 'declined' }, 409], [{ status: 'completed', requestKind: 'conversation' }, 404], [{ id: 102 }, 404]]) {
    const h = feedbackHarness({ missions: [baseMission(overrides)] }); assert.equal((await review(h)).status, expected); assert.equal(h.rows.feedback.length, 0);
  }
});
test('review uses authenticated mission identity and permits exactly one review per mission', async () => {
  const h = feedbackHarness(); const response = await review(h, { customerName: 'Spoofed', customerPhone: 'Spoofed', requestReference: 'MS-other' });
  assert.equal(response.status, 201); assert.equal(h.rows.feedback.length, 1);
  assert.equal(h.rows.feedback[0].requestReference, 'MS-101'); assert.equal(h.rows.feedback[0].customerName, 'Fixture Client'); assert.equal(h.rows.feedback[0].customerPhone, 'fixture-phone');
  assert.equal(h.actions.notifications.length, 1); assert.equal(h.actions.notifications[0].recipientId, 22); assert.deepEqual(h.actions.locks, ['update']); assert.equal(h.actions.transactions, 1);
  assert.equal((await review(h)).status, 409); assert.equal(h.rows.feedback.length, 1); assert.equal(h.actions.notifications.length, 1);
});
test('reviews remain separate when one client has two completed missions', async () => {
  const h = feedbackHarness({ missions: [baseMission({ status: 'completed', reference: 'MS-101' }), baseMission({ id: 102, status: 'completed', reference: 'MS-102' })] });
  assert.equal((await review(h)).status, 201); assert.equal((await review(h, { requestId: 102 })).status, 201);
  assert.deepEqual(h.rows.feedback.map(f => f.requestReference), ['MS-101', 'MS-102']);
});
test('review validates rating, mission, and details without writes', async () => {
  for (const body of [{ rating: 0 }, { rating: 6 }, { rating: 2.5 }, { rating: 'bad' }, { requestId: 0 }, { details: ' ' }]) {
    const h = feedbackHarness(); assert.equal((await review(h, body)).status, 400); assert.equal(h.rows.feedback.length, 0);
  }
});
test('notification failure does not turn successful review into a retryable error', async () => {
  const h = feedbackHarness({ notificationFails: true }); assert.equal((await review(h)).status, 201); assert.equal(h.rows.feedback.length, 1);
});
test('complaint intake remains available without an account', async () => {
  const h = feedbackHarness({ member: null }); const response = await post(h, { kind: 'complaint', customerName: 'Fixture Client', customerPhone: 'fixture-phone', details: 'Une réclamation.' });
  assert.equal(response.status, 201); assert.equal(h.rows.feedback[0].kind, 'complaint'); assert.equal(h.rows.feedback[0].requestReference, null);
});
test('service POST creates a pending mission for a registered client with stable IDs and no chat message', async () => {
  const h = serviceHarness(); const response = await newMission(h, { requesterExpertId: 33, accountId: 88, customerName: 'Spoofed' }); const body = await response.json();
  assert.equal(response.status, 201); assert.equal(h.rows.missions.length, 1); const mission = h.rows.missions[0];
  assert.equal(mission.requesterExpertId, 11); assert.equal(mission.targetExpertId, 22); assert.equal(mission.accountId, 77); assert.equal(mission.customerName, 'Shared display name');
  assert.equal(mission.expertDecision, 'pending'); assert.equal(mission.requestKind, 'service'); assert.equal(policy.hasMissionConversation(mission), false); assert.equal(h.rows.messages.length, 0);
  assert.equal(body.missionUrl, `/espace-expert?tab=missions&request=${body.requestId}`); assert.equal(body.conversationUrl, undefined);
  assert.deepEqual(h.actions.locks, ['update']); assert.equal(h.actions.transactions, 1); assert.equal(h.actions.notifications[0].recipientId, 22); assert.equal(h.actions.notificationsInsideTransaction, 0);
});
test('service POST denies anonymous users, self requests, missing and unapproved providers', async () => {
  for (const [setup, body, expected] of [[{ member: null }, {}, 401], [{}, { targetExpertId: 11 }, 409], [{}, { targetExpertId: 33 }, 404], [{ members: [{ id: 11, status: 'account_only' }, { id: 22, status: 'pending' }] }, {}, 404]]) {
    const h = serviceHarness(setup); assert.equal((await newMission(h, body)).status, expected); assert.equal(h.rows.missions.length, 0); assert.equal(h.actions.notifications.length, 0);
  }
});
test('service POST validates the request before creating a mission', async () => {
  for (const body of [{ targetExpertId: 0 }, { targetExpertId: 2.5 }, { details: 'Court' }, { details: ' ' }]) {
    const h = serviceHarness(); assert.equal((await newMission(h, body)).status, 400); assert.equal(h.rows.missions.length, 0);
  }
});
test('service POST repeated submission is rejected with 429 and remains one mission', async () => {
  const h = serviceHarness(); assert.equal((await newMission(h)).status, 201); assert.equal((await newMission(h)).status, 429);
  assert.equal(h.rows.missions.length, 1); assert.equal(h.actions.notifications.length, 1); assert.equal(h.rows.messages.length, 0);
});
test('service duplicate window uses participant IDs, allowing another provider and expired requests', async () => {
  const h = serviceHarness({ missions: [baseMission({ requesterExpertId: 11, targetExpertId: 33, createdAt: new Date() }), baseMission({ id: 102, requesterExpertId: 11, targetExpertId: 22, createdAt: new Date(Date.now() - 121000) })] });
  assert.equal((await newMission(h)).status, 201); assert.equal(h.rows.missions.length, 3);
});
test('service POST succeeds even if its notification cannot be delivered', async () => {
  const h = serviceHarness({ notificationFails: true }); assert.equal((await newMission(h)).status, 201); assert.equal(h.rows.missions.length, 1); assert.equal(h.actions.notificationsInsideTransaction, 0);
});
test('service PATCH cancellation is restricted to the requester and cannot affect a terminal mission', async () => {
  for (const [setup, expected] of [[{ member: null }, 403], [{ member: 22, status: 'accepted' }, 403], [{ member: 33 }, 403], [{ missions: [baseMission({ status: 'completed' })] }, 409], [{ missions: [baseMission({ status: 'cancelled' })] }, 409], [{ missions: [baseMission({ requestKind: 'conversation' })] }, 403]]) {
    const h = serviceHarness({ missions: [baseMission()], ...setup }); assert.equal((await patch(h, { requestId: 101, action: 'cancel' })).status, expected); assert.equal(h.actions.updates.length, 0); assert.equal(h.rows.messages.length, 0);
  }
});
test('service PATCH owner can cancel pending mission, once, and disables its conversation', async () => {
  const h = serviceHarness({ missions: [baseMission({ expertDecision: 'pending' })] }); const response = await patch(h, { requestId: 101, action: 'cancel' }); const body = await response.json();
  assert.equal(response.status, 200); assert.equal(body.request.status, 'cancelled'); assert.equal(policy.hasMissionConversation(body.request), false); assert.equal('accessCodeHash' in body.request, false);
  assert.equal(h.actions.notifications[0].recipientId, 22); assert.equal(h.actions.notificationsInsideTransaction, 0); assert.deepEqual(h.actions.locks, ['update']);
  assert.equal((await patch(h, { requestId: 101, action: 'cancel' })).status, 409); assert.equal(h.actions.updates.length, 1);
});
test('service PATCH quote response requires owner, accepted mission, and pending quote', async () => {
  for (const [setup, expected] of [[{ member: 22, status: 'accepted' }, 403], [{ member: 33 }, 403], [{ missions: [baseMission({ expertDecision: 'pending', quoteStatus: 'pending' })] }, 409], [{ missions: [baseMission({ quoteStatus: 'accepted' })] }, 409], [{ missions: [baseMission({ status: 'completed', quoteStatus: 'pending' })] }, 409]]) {
    const h = serviceHarness({ missions: [baseMission({ quoteStatus: 'pending', quoteAmount: 1000 })], ...setup }); assert.equal((await patch(h, { requestId: 101, action: 'accept_quote' })).status, expected); assert.equal(h.actions.updates.length, 0);
  }
});
test('service PATCH owner can accept or reject a quote and second response conflicts', async () => {
  for (const [action, quoteStatus] of [['accept_quote', 'accepted'], ['reject_quote', 'rejected']]) {
    const h = serviceHarness({ missions: [baseMission({ quoteStatus: 'pending', quoteAmount: 1000 })] }); const response = await patch(h, { requestId: 101, action }); const body = await response.json();
    assert.equal(response.status, 200); assert.equal(body.request.quoteStatus, quoteStatus); assert.equal(h.rows.messages.length, 1); assert.equal(h.actions.notificationsInsideTransaction, 0);
    assert.equal((await patch(h, { requestId: 101, action })).status, 409); assert.equal(h.actions.updates.length, 1);
  }
});
test('service PATCH committed cancellation remains successful if notification fails', async () => {
  const h = serviceHarness({ missions: [baseMission()], notificationFails: true }); assert.equal((await patch(h, { requestId: 101, action: 'cancel' })).status, 200); assert.equal(h.rows.missions[0].status, 'cancelled'); assert.equal(h.actions.notificationsInsideTransaction, 0);
});
