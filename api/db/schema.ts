import { relations } from 'drizzle-orm';
import { int, mysqlTable, text, varchar, timestamp } from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';

export const projects = mysqlTable('e2e_projects', {
  id: varchar('id', { length: 255 }).primaryKey(),
  name: text('name').notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  baseUrl: text('base_url'),
  mobileConfig: text('mobile_config'),
  createdAt: timestamp('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`).onUpdateNow(),
});

export const projectsRelations = relations(projects, ({ many }) => ({
  features: many(features),
  testRuns: many(testRuns),
  stepDefinitions: many(stepDefinitions),
}));

export const features = mysqlTable('e2e_features', {
  id: varchar('id', { length: 255 }).primaryKey(),
  projectId: varchar('project_id', { length: 255 }).notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  framework: varchar('framework', { length: 50 }).notNull(),
  description: text('description'),
  content: text('content').notNull(),
  enabled: int('enabled').notNull().default(1),
  createdAt: timestamp('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`).onUpdateNow(),
});

export const featuresRelations = relations(features, ({ one, many }) => ({
  project: one(projects, {
    fields: [features.projectId],
    references: [projects.id],
  }),
  scenarioSteps: many(scenarioSteps),
}));

export const testRuns = mysqlTable('e2e_test_runs', {
  id: varchar('id', { length: 255 }).primaryKey(),
  projectId: varchar('project_id', { length: 255 }).notNull().references(() => projects.id, { onDelete: 'cascade' }),
  featureIds: text('feature_ids').notNull(),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  recordingPath: text('recording_path'),
  screenshotPaths: text('screenshot_paths'),
  resultJson: text('result_json'),
  errorMessage: text('error_message'),
  recordTestRun: int('record_test_run').notNull().default(0),
  takeScreenshots: int('take_screenshots').notNull().default(1),
});

export const testRunsRelations = relations(testRuns, ({ one }) => ({
  project: one(projects, {
    fields: [testRuns.projectId],
    references: [projects.id],
  }),
}));

export const stepDefinitions = mysqlTable('e2e_step_definitions', {
  id: varchar('id', { length: 255 }).primaryKey(),
  projectId: varchar('project_id', { length: 255 }).notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  category: varchar('category', { length: 50 }),
  gherkinPattern: text('gherkin_pattern').notNull(),
  playwrightFunction: varchar('playwright_function', { length: 100 }).notNull(),
  parameters: text('parameters'),
  description: text('description'),
  enabled: int('enabled').notNull().default(1),
  createdAt: timestamp('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`).onUpdateNow(),
});

export const stepDefinitionsRelations = relations(stepDefinitions, ({ one }) => ({
  project: one(projects, {
    fields: [stepDefinitions.projectId],
    references: [projects.id],
  }),
}));

export const scenarioSteps = mysqlTable('e2e_scenario_steps', {
  id: varchar('id', { length: 255 }).primaryKey(),
  featureId: varchar('feature_id', { length: 255 }).notNull().references(() => features.id, { onDelete: 'cascade' }),
  scenarioName: text('scenario_name').notNull(),
  stepDefinitionId: varchar('step_definition_id', { length: 255 }).notNull().references(() => stepDefinitions.id, { onDelete: 'cascade' }),
  stepOrder: int('step_order').notNull(),
  parameterValues: text('parameter_values'),
  createdAt: timestamp('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const scenarioStepsRelations = relations(scenarioSteps, ({ one }) => ({
  feature: one(features, {
    fields: [scenarioSteps.featureId],
    references: [features.id],
  }),
  stepDefinition: one(stepDefinitions, {
    fields: [scenarioSteps.stepDefinitionId],
    references: [stepDefinitions.id],
  }),
}));
