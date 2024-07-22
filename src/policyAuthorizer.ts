// API for add, delete, list, match
import { components } from './model';

type Policy = components['schemas']['Policy'];
type CreatePolicyRequest =
  components['requestBodies']['CreatePolicyRequest']['content']['application/json'];
type Action = components['schemas']['Action'];
interface PolicyMap {
  [principal: string]: Policy[];
}

export interface AuthzRequest {
  principal: string;
  action: Action;
  resource: string;
}

// Would probably separate this into storage and enforcement modules.
//  Coupling for time's sake.
export class PolicyAuthorizer {
  private policies: PolicyMap = {};
  private idCounter: number = 0;

  constructor() {}

  addPolicy(principal: string, policyReq: CreatePolicyRequest): Policy {
    const policy: Policy = {
      id: `policy_${this.idCounter}`,
      actions: policyReq.actions,
      resource: policyReq.resource,
      principal: principal,
      effect: policyReq.effect,
    };
    this.idCounter++;
    if (!this.policies[principal]) {
      this.policies[principal] = [];
    }
    this.policies[principal].push(policy);
    return policy;
  }

  listPolicies(principal: string): Policy[] {
    return this.policies[principal] || [];
  }

  deletePolicy(principal: string, policyId: string): boolean {
    const principalPolicies = this.policies[principal];
    if (!principalPolicies) {
      return false;
    }
    const policyIndex = principalPolicies.findIndex(policy => policy.id === policyId);
    if (policyIndex === -1) {
      return false;
    }
    principalPolicies.splice(policyIndex, 1);
    if (principalPolicies.length === 0) {
      delete this.policies[principal];
    }
    return true;
  }

  authorized(req: AuthzRequest): boolean {
    const principalsPolicies = this.policies[req.principal];
    if (!principalsPolicies) {
      return false;
    }
    // Making the assumption the number of policies defined per principal is pretty small.
    //  In a real system where policies aren't constrained to a single principle, or we
    //  need even more efficiency, we'd store this more efficiently to prevent having to iterate
    //  over every policy for a principal.
    //  Also, we'd probably store this in a SQL db, not in memory (lol).
    const matchingPolicies = [];
    let atLeastOneAllowMatches = false;
    for (const policy of principalsPolicies) {
      if (this.matches(req, policy)) {
        console.log(
          'Request: ',
          req,
          `matches ${policy.effect} policy: `,
          policy,
        );
        if (policy.effect === 'deny') {
          return false;
        } else if (policy.effect === 'allow') {
          // This is really the only other branch, but being explicit in case code changes.
          atLeastOneAllowMatches = true;
        }
        matchingPolicies.push(policy);
      }
    }
    return atLeastOneAllowMatches;
  }

  private matches(req: AuthzRequest, policy: Policy): boolean {
    /*
    A policy matches iff all the following are true:
      1. req.principal === policy.principal
      2. req.action in (policy.actions) or policy.actions is empty
      3. req.resources policy.resource, or policy.resource is empty
     */
    const principalMatches = req.principal === policy.principal;
    // Storing actions in a set would be ideal, but OpenAPI generator generates arrays.
    //  not changing for time's sake.
    const actionMatches =
      !policy.actions ||
      policy.actions.length === 0 ||
      policy.actions.includes(req.action);
    const resourceMatches =
      !policy.resource || req.resource === policy.resource;
    return principalMatches && actionMatches && resourceMatches;
  }
}
