/**
 * @fileoverview Complete metadata dictionary for all Smile built-in rules across all 6 formats.
 * Used by the Visual Rules Manager and configuration wizards.
 */

import { ESpecFormat, type RuleSeverity } from "@mrjacket/smile";

/**
 * Metadata definition for an individual Smile contract rule.
 */
export interface IRuleMetadata {
  /** Identifier of the rule (e.g. 'missing-operation-id'). */
  id: string;
  /** Human-readable display title. */
  title: string;
  /** Detailed explanation of the contract requirement. */
  description: string;
  /** Specification format this rule targets. */
  format: ESpecFormat;
  /** Built-in default severity. */
  defaultSeverity: RuleSeverity;
  /** Whether the rule can be automatically resolved via AST QuickFix. */
  isFixable?: boolean;
}

/**
 * Registry of all official Smile rules organized with user-friendly descriptions and defaults.
 */
export const SMILE_RULES_METADATA: readonly IRuleMetadata[] = [
  // ─── OpenAPI ─────────────────────────────────────────────────────────────
  {
    id: "missing-operation-id",
    title: "Missing Operation ID",
    description: "Requires every HTTP operation to define a unique, deterministic operationId for client SDK generation.",
    format: ESpecFormat.OpenApi,
    defaultSeverity: "error",
    isFixable: true,
  },
  {
    id: "missing-summary",
    title: "Missing Operation Summary",
    description: "Requires every HTTP endpoint to define a concise, descriptive summary.",
    format: ESpecFormat.OpenApi,
    defaultSeverity: "warn",
    isFixable: true,
  },
  {
    id: "missing-responses",
    title: "Missing Responses Object",
    description: "Guarantees that each operation specifies an explicit HTTP responses block.",
    format: ESpecFormat.OpenApi,
    defaultSeverity: "error",
  },
  {
    id: "no-2xx-response",
    title: "Missing 2xx Success Response",
    description: "Requires at least one 2xx success response code (e.g. 200 OK or 201 Created) per operation.",
    format: ESpecFormat.OpenApi,
    defaultSeverity: "error",
  },
  {
    id: "untyped-schema-property",
    title: "Untyped Schema Property",
    description: "Flags schema properties that lack an explicit data type declaration.",
    format: ESpecFormat.OpenApi,
    defaultSeverity: "error",
  },
  {
    id: "valid-examples",
    title: "Valid Schema Examples",
    description: "Validates that inline and schema examples conform to their defined types.",
    format: ESpecFormat.OpenApi,
    defaultSeverity: "warn",
  },
  {
    id: "require-security",
    title: "Require Security Scheme",
    description: "Ensures operations define explicit security authentication schemes.",
    format: ESpecFormat.OpenApi,
    defaultSeverity: "warn",
  },
  {
    id: "no-http-verbs-in-path",
    title: "No HTTP Verbs in Path",
    description: "Enforces RESTful URI standards by disallowing verbs (get, post, delete) in endpoint paths.",
    format: ESpecFormat.OpenApi,
    defaultSeverity: "warn",
  },
  {
    id: "strict-hypermedia",
    title: "Strict Hypermedia (HATEOAS)",
    description: "Validates hypermedia links and relation headers across response representations.",
    format: ESpecFormat.OpenApi,
    defaultSeverity: "warn",
  },
  {
    id: "valid-path-parameters",
    title: "Valid Path Parameters",
    description: "Ensures all {param} tokens in URI paths have corresponding parameter definitions.",
    format: ESpecFormat.OpenApi,
    defaultSeverity: "error",
  },

  // ─── AsyncAPI ────────────────────────────────────────────────────────────
  {
    id: "missing-operation-id",
    title: "Missing Async Operation ID",
    description: "Requires asynchronous pub/sub operations to declare an operationId.",
    format: ESpecFormat.AsyncApi,
    defaultSeverity: "error",
    isFixable: true,
  },
  {
    id: "missing-message",
    title: "Missing Channel Message",
    description: "Guarantees channels have an associated message definition.",
    format: ESpecFormat.AsyncApi,
    defaultSeverity: "error",
  },
  {
    id: "missing-channel-description",
    title: "Missing Channel Description",
    description: "Requires topics and channels to be documented with a description.",
    format: ESpecFormat.AsyncApi,
    defaultSeverity: "warn",
  },
  {
    id: "missing-message-description",
    title: "Missing Message Description",
    description: "Requires message payloads and events to declare descriptive documentation.",
    format: ESpecFormat.AsyncApi,
    defaultSeverity: "warn",
  },
  {
    id: "untyped-schema-property",
    title: "Untyped Event Property",
    description: "Flags event payload properties that lack explicit schema types.",
    format: ESpecFormat.AsyncApi,
    defaultSeverity: "error",
  },

  // ─── GraphQL ─────────────────────────────────────────────────────────────
  {
    id: "missing-type-description",
    title: "Missing Type Description",
    description: "Requires GraphQL Object, Interface, and Union types to include documentation strings.",
    format: ESpecFormat.GraphQL,
    defaultSeverity: "warn",
  },
  {
    id: "missing-field-description",
    title: "Missing Field Description",
    description: "Requires fields on GraphQL types to provide clear descriptions.",
    format: ESpecFormat.GraphQL,
    defaultSeverity: "warn",
  },
  {
    id: "deprecated-without-reason",
    title: "Deprecated Without Reason",
    description: "Flags fields using @deprecated without providing an explanatory reason string.",
    format: ESpecFormat.GraphQL,
    defaultSeverity: "warn",
  },
  {
    id: "missing-enum-value-description",
    title: "Missing Enum Value Description",
    description: "Requires enum options to define descriptive explanations.",
    format: ESpecFormat.GraphQL,
    defaultSeverity: "warn",
  },
  {
    id: "require-pascal-case-types",
    title: "PascalCase Type Names",
    description: "Enforces standard PascalCase naming conventions on all GraphQL type definitions.",
    format: ESpecFormat.GraphQL,
    defaultSeverity: "error",
  },
  {
    id: "require-camel-case-fields",
    title: "camelCase Field Names",
    description: "Enforces camelCase naming conventions on all GraphQL fields and query arguments.",
    format: ESpecFormat.GraphQL,
    defaultSeverity: "error",
  },

  // ─── JSON Schema ─────────────────────────────────────────────────────────
  {
    id: "missing-title",
    title: "Missing Schema Title",
    description: "Requires top-level JSON Schemas to define a meaningful title attribute.",
    format: ESpecFormat.JsonSchema,
    defaultSeverity: "warn",
  },
  {
    id: "missing-description",
    title: "Missing Schema Description",
    description: "Requires schema definitions and nested models to provide descriptive context.",
    format: ESpecFormat.JsonSchema,
    defaultSeverity: "warn",
  },
  {
    id: "untyped-property",
    title: "Untyped Property",
    description: "Ensures all properties explicitly specify a primitive or complex 'type'.",
    format: ESpecFormat.JsonSchema,
    defaultSeverity: "error",
  },
  {
    id: "array-without-items",
    title: "Array Without Items",
    description: "Guarantees array schemas specify an 'items' schema defining element types.",
    format: ESpecFormat.JsonSchema,
    defaultSeverity: "error",
  },
  {
    id: "require-additional-properties",
    title: "Explicit Additional Properties",
    description: "Encourages strict contracts by explicitly setting additionalProperties to false.",
    format: ESpecFormat.JsonSchema,
    defaultSeverity: "warn",
  },

  // ─── gRPC / Protobuf ─────────────────────────────────────────────────────
  {
    id: "require-rpc-comments",
    title: "Documented RPC Methods",
    description: "Requires all protobuf service RPC definitions to have documentation comments.",
    format: ESpecFormat.Grpc,
    defaultSeverity: "error",
  },
  {
    id: "pascal-case-messages",
    title: "PascalCase Protobuf Messages",
    description: "Enforces PascalCase naming on message definitions in .proto specifications.",
    format: ESpecFormat.Grpc,
    defaultSeverity: "error",
  },
  {
    id: "camel-case-fields",
    title: "camelCase Protobuf Fields",
    description: "Enforces camelCase naming on field definitions in protobuf messages.",
    format: ESpecFormat.Grpc,
    defaultSeverity: "error",
  },

  // ─── Postman ─────────────────────────────────────────────────────────────
  {
    id: "require-request-description",
    title: "Documented Postman Requests",
    description: "Requires requests in Postman collections to contain descriptive documentation.",
    format: ESpecFormat.Postman,
    defaultSeverity: "error",
  },
  {
    id: "no-empty-folders",
    title: "No Empty Folders",
    description: "Flags empty folder groups within Postman collections.",
    format: ESpecFormat.Postman,
    defaultSeverity: "warn",
  },
  {
    id: "require-response-example",
    title: "Documented Response Examples",
    description: "Requires collection endpoints to include at least one saved response example.",
    format: ESpecFormat.Postman,
    defaultSeverity: "error",
  },
];
