import { PolicyAuthorizer, AuthzRequest } from '../src/policyAuthorizer.js';
import { components } from '../src/model.js';

type CreatePolicyRequest =
  components['requestBodies']['CreatePolicyRequest']['content']['application/json'];
type Action = components['schemas']['Action'];

describe('PolicyAuthorizer', () => {
  let authorizer: PolicyAuthorizer;

  beforeEach(() => {
    authorizer = new PolicyAuthorizer();
  });

  test('should add a policy', () => {
    const policyReq: CreatePolicyRequest = {
      actions: ['select'],
      resource: 'resource1',
      principal: 'user1',
      effect: 'allow',
    };

    const policy = authorizer.addPolicy('user1', policyReq);

    expect(policy).toEqual({
      id: 'policy_0',
      actions: ['select'],
      resource: 'resource1',
      principal: 'user1',
      effect: 'allow',
    });

    expect(authorizer['policies']['user1']).toContainEqual(policy);
  });

  test('should return false if no policies for principal', () => {
    const req: AuthzRequest = {
      principal: 'user1',
      action: 'select',
      resource: 'resource1',
    };

    expect(authorizer.authorized(req)).toBe(false);
  });

  test('should return false if a deny policy matches', () => {
    const policyReq: CreatePolicyRequest = {
      actions: ['select'],
      resource: 'resource1',
      principal: 'user1',
      effect: 'deny',
    };

    authorizer.addPolicy('user1', policyReq);

    const req: AuthzRequest = {
      principal: 'user1',
      action: 'select',
      resource: 'resource1',
    };

    expect(authorizer.authorized(req)).toBe(false);
  });

  test('should return true if an allow policy matches', () => {
    const policyReq: CreatePolicyRequest = {
      actions: ['select'],
      resource: 'resource1',
      principal: 'user1',
      effect: 'allow',
    };

    authorizer.addPolicy('user1', policyReq);

    const req: AuthzRequest = {
      principal: 'user1',
      action: 'select',
      resource: 'resource1',
    };

    expect(authorizer.authorized(req)).toBe(true);
  });

  test('should return false if allow and deny policies match', () => {
    const denyPolicyReq: CreatePolicyRequest = {
      actions: ['select'],
      resource: 'resource1',
      principal: 'user1',
      effect: 'deny',
    };

    const allowPolicyReq: CreatePolicyRequest = {
      actions: ['select'],
      resource: 'resource1',
      principal: 'user1',
      effect: 'allow',
    };

    authorizer.addPolicy('user1', denyPolicyReq);
    authorizer.addPolicy('user1', allowPolicyReq);

    const req: AuthzRequest = {
      principal: 'user1',
      action: 'select',
      resource: 'resource1',
    };

    expect(authorizer.authorized(req)).toBe(false);
  });

  test('should return false if no policies match', () => {
    const policyReq: CreatePolicyRequest = {
      actions: ['select'],
      resource: 'resource1',
      principal: 'user1',
      effect: 'allow',
    };

    authorizer.addPolicy('user1', policyReq);

    const req: AuthzRequest = {
      principal: 'user1',
      action: 'update',
      resource: 'resource1',
    };

    expect(authorizer.authorized(req)).toBe(false);
  });
});

describe('PolicyAuthorizer - Empty Actions or Resources', () => {
  let authorizer: PolicyAuthorizer;

  beforeEach(() => {
    authorizer = new PolicyAuthorizer();
  });

  test('should allow all actions if allow policy with empty actions', () => {
    const policyReq: CreatePolicyRequest = {
      actions: [],
      resource: 'resource1',
      principal: 'user1',
      effect: 'allow',
    };

    authorizer.addPolicy('user1', policyReq);

    const actions: Action[] = ['select', 'update', 'delete'];

    actions.forEach((action) => {
      const req: AuthzRequest = {
        principal: 'user1',
        action: action,
        resource: 'resource1',
      };
      expect(authorizer.authorized(req)).toBe(true);
    });
  });

  test('should deny all actions if deny policy with empty actions', () => {
    const policyReq: CreatePolicyRequest = {
      actions: [],
      resource: 'resource1',
      principal: 'user1',
      effect: 'deny',
    };

    authorizer.addPolicy('user1', policyReq);

    const actions: Action[] = ['select', 'update', 'delete'];

    actions.forEach((action) => {
      const req: AuthzRequest = {
        principal: 'user1',
        action,
        resource: 'resource1',
      };
      expect(authorizer.authorized(req)).toBe(false);
    });
  });

  test('should allow access to all resources if allow policy with empty resource', () => {
    const policyReq: CreatePolicyRequest = {
      actions: ['select'],
      resource: '',
      principal: 'user1',
      effect: 'allow',
    };

    authorizer.addPolicy('user1', policyReq);

    const resources: string[] = ['resource1', 'resource2', 'resource3'];

    resources.forEach((resource) => {
      const req: AuthzRequest = {
        principal: 'user1',
        action: 'select',
        resource,
      };
      expect(authorizer.authorized(req)).toBe(true);
    });
  });

  test('should deny access to all resources if deny policy with empty resource', () => {
    const policyReq: CreatePolicyRequest = {
      actions: ['select'],
      resource: '',
      principal: 'user1',
      effect: 'deny',
    };

    authorizer.addPolicy('user1', policyReq);

    const resources: string[] = ['resource1', 'resource2', 'resource3'];

    resources.forEach((resource) => {
      const req: AuthzRequest = {
        principal: 'user1',
        action: 'select',
        resource,
      };
      expect(authorizer.authorized(req)).toBe(false);
    });
  });

  test('should allow all actions on all resources if allow policy with empty actions and resource', () => {
    const policyReq: CreatePolicyRequest = {
      actions: [],
      resource: '',
      principal: 'user1',
      effect: 'allow',
    };

    authorizer.addPolicy('user1', policyReq);

    const actions: Action[] = ['select', 'update', 'delete'];
    const resources: string[] = ['resource1', 'resource2', 'resource3'];

    actions.forEach((action) => {
      resources.forEach((resource) => {
        const req: AuthzRequest = {
          principal: 'user1',
          action,
          resource,
        };
        expect(authorizer.authorized(req)).toBe(true);
      });
    });
  });

  test('should deny all actions on all resources if deny policy with empty actions and resource', () => {
    const policyReq: CreatePolicyRequest = {
      actions: [],
      resource: '',
      principal: 'user1',
      effect: 'deny',
    };

    authorizer.addPolicy('user1', policyReq);

    const actions: Action[] = ['select', 'update', 'delete'];
    const resources: string[] = ['resource1', 'resource2', 'resource3'];

    actions.forEach((action) => {
      resources.forEach((resource) => {
        const req: AuthzRequest = {
          principal: 'user1',
          action: action,
          resource,
        };
        expect(authorizer.authorized(req)).toBe(false);
      });
    });
  });
});
