// API for add, delete, list, match
import { components } from './model';

type Policy = components['schemas']['Policy'];
type Action = components['schemas']['Action'];
// TODO: Add id to policy for access/removal.
interface PolicyMap {
  [principal: string]: [Policy];
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

  constructor() {}

  addPolicy(principal: string, policy: Policy) {
    this.policies[principal].push(policy);
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
      3. req.resource === policy.resource, or policy.resource is empty
     */
    const principalMatches = req.principal === policy.principal;
    // Storing actions in a set would be ideal, but OpenAPI generator generates arrays.
    //  not changing for time's sake.
    const actionMatches =
      policy.actions.length === 0 || policy.actions.includes(req.action);
    const resourceMatches =
      !policy.resource || req.resource === policy.resource;
    return principalMatches && actionMatches && resourceMatches;
  }
}
