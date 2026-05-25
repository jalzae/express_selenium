CREATE TABLE `e2e_features` (
	`id` varchar(255) NOT NULL,
	`project_id` varchar(255) NOT NULL,
	`name` text NOT NULL,
	`framework` varchar(50) NOT NULL,
	`description` text,
	`content` text NOT NULL,
	`enabled` int NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `e2e_features_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `e2e_projects` (
	`id` varchar(255) NOT NULL,
	`name` text NOT NULL,
	`type` varchar(50) NOT NULL,
	`base_url` text,
	`mobile_config` text,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `e2e_projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `e2e_scenario_steps` (
	`id` varchar(255) NOT NULL,
	`feature_id` varchar(255) NOT NULL,
	`scenario_name` text NOT NULL,
	`step_definition_id` varchar(255) NOT NULL,
	`step_order` int NOT NULL,
	`parameter_values` text,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `e2e_scenario_steps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `e2e_step_definitions` (
	`id` varchar(255) NOT NULL,
	`project_id` varchar(255) NOT NULL,
	`name` text NOT NULL,
	`category` varchar(50),
	`gherkin_pattern` text NOT NULL,
	`playwright_function` varchar(100) NOT NULL,
	`parameters` text,
	`description` text,
	`enabled` int NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `e2e_step_definitions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `e2e_test_runs` (
	`id` varchar(255) NOT NULL,
	`project_id` varchar(255) NOT NULL,
	`feature_ids` text NOT NULL,
	`status` varchar(50) NOT NULL DEFAULT 'pending',
	`started_at` timestamp,
	`completed_at` timestamp,
	`recording_path` text,
	`screenshot_paths` text,
	`result_json` text,
	`error_message` text,
	`record_test_run` int NOT NULL DEFAULT 0,
	`take_screenshots` int NOT NULL DEFAULT 1,
	CONSTRAINT `e2e_test_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `e2e_features` ADD CONSTRAINT `e2e_features_project_id_e2e_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `e2e_projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `e2e_scenario_steps` ADD CONSTRAINT `e2e_scenario_steps_feature_id_e2e_features_id_fk` FOREIGN KEY (`feature_id`) REFERENCES `e2e_features`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `e2e_scenario_steps` ADD CONSTRAINT `e2e_scenario_steps_step_definition_id_e2e_step_definitions_id_fk` FOREIGN KEY (`step_definition_id`) REFERENCES `e2e_step_definitions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `e2e_step_definitions` ADD CONSTRAINT `e2e_step_definitions_project_id_e2e_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `e2e_projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `e2e_test_runs` ADD CONSTRAINT `e2e_test_runs_project_id_e2e_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `e2e_projects`(`id`) ON DELETE cascade ON UPDATE no action;