CREATE TABLE `account_metrics_daily` (
	`account_id` text NOT NULL,
	`date` integer NOT NULL,
	`dau` integer DEFAULT 0 NOT NULL,
	`events` integer DEFAULT 0 NOT NULL,
	`features_used` text DEFAULT '[]' NOT NULL,
	`prompt_runs` integer DEFAULT 0 NOT NULL,
	`token_cost_usd_microcents` integer DEFAULT 0 NOT NULL,
	`mrr_usd_cents` integer DEFAULT 0 NOT NULL,
	`margin_usd_cents` integer DEFAULT 0 NOT NULL,
	`health_score` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`account_id`, `date`)
);
--> statement-breakpoint
CREATE INDEX `account_metrics_by_date` ON `account_metrics_daily` (`date`);--> statement-breakpoint
CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`plan_tier` text NOT NULL,
	`status` text NOT NULL,
	`stripe_customer_id` text,
	`created_at` integer NOT NULL,
	`churned_at` integer,
	`country` text,
	`owner_user_id` text,
	`workspace_count` integer DEFAULT 1 NOT NULL,
	`tracked_prompts_limit` integer DEFAULT 50 NOT NULL,
	`engines_limit` integer DEFAULT 3 NOT NULL,
	`mrr_usd_cents` integer DEFAULT 0 NOT NULL,
	`synced_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `accounts_by_plan` ON `accounts` (`plan_tier`);--> statement-breakpoint
CREATE INDEX `accounts_by_status` ON `accounts` (`status`);--> statement-breakpoint
CREATE INDEX `accounts_by_created` ON `accounts` (`created_at`);--> statement-breakpoint
CREATE TABLE `admin_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`status` text NOT NULL,
	`requested_by` text NOT NULL,
	`approved_by` text,
	`target_account_id` text,
	`params` text DEFAULT '{}' NOT NULL,
	`expires_at` integer,
	`product_api_response` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `admin_actions_by_type` ON `admin_actions` (`type`);--> statement-breakpoint
CREATE INDEX `admin_actions_by_status` ON `admin_actions` (`status`);--> statement-breakpoint
CREATE INDEX `admin_actions_by_target` ON `admin_actions` (`target_account_id`);--> statement-breakpoint
CREATE TABLE `alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`metric_key` text NOT NULL,
	`dims` text DEFAULT '{}' NOT NULL,
	`severity` text NOT NULL,
	`z_score` real,
	`threshold` real,
	`status` text NOT NULL,
	`fired_at` integer NOT NULL,
	`acked_at` integer,
	`resolved_at` integer,
	`owner_role` text NOT NULL,
	`slack_ts` text
);
--> statement-breakpoint
CREATE INDEX `alerts_by_status` ON `alerts` (`status`);--> statement-breakpoint
CREATE INDEX `alerts_by_metric` ON `alerts` (`metric_key`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`at` integer NOT NULL,
	`actor_staff_id` text NOT NULL,
	`actor_role` text NOT NULL,
	`action` text NOT NULL,
	`object_type` text NOT NULL,
	`object_id` text NOT NULL,
	`before_json` text,
	`after_json` text,
	`reason` text DEFAULT '' NOT NULL,
	`ip` text DEFAULT '' NOT NULL,
	`user_agent` text DEFAULT '' NOT NULL,
	`prev_hash` text DEFAULT '' NOT NULL,
	`hash` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_by_actor` ON `audit_log` (`actor_staff_id`);--> statement-breakpoint
CREATE INDEX `audit_by_action` ON `audit_log` (`action`);--> statement-breakpoint
CREATE INDEX `audit_by_object` ON `audit_log` (`object_type`,`object_id`);--> statement-breakpoint
CREATE INDEX `audit_by_time` ON `audit_log` (`at`);--> statement-breakpoint
CREATE TABLE `channel_spend` (
	`month` text NOT NULL,
	`channel` text NOT NULL,
	`spend_usd_cents` integer DEFAULT 0 NOT NULL,
	`source` text DEFAULT 'csv_import' NOT NULL,
	`imported_by` text NOT NULL,
	PRIMARY KEY(`month`, `channel`)
);
--> statement-breakpoint
CREATE TABLE `cohort_retention_monthly` (
	`cohort_month` integer NOT NULL,
	`month_n` integer NOT NULL,
	`segment` text DEFAULT 'all' NOT NULL,
	`accounts_start` integer DEFAULT 0 NOT NULL,
	`accounts_retained` integer DEFAULT 0 NOT NULL,
	`grr_pct` real DEFAULT 0 NOT NULL,
	`nrr_pct` real DEFAULT 0 NOT NULL,
	`mrr_start_usd_cents` integer DEFAULT 0 NOT NULL,
	`mrr_retained_usd_cents` integer DEFAULT 0 NOT NULL,
	`mrr_expansion_usd_cents` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`cohort_month`, `month_n`, `segment`)
);
--> statement-breakpoint
CREATE TABLE `company_inputs_quarterly` (
	`quarter` text PRIMARY KEY NOT NULL,
	`sm_expense_usd_cents` integer DEFAULT 0 NOT NULL,
	`gross_margin_pct` real DEFAULT 0 NOT NULL,
	`fcf_margin_pct` real DEFAULT 0 NOT NULL,
	`entered_by` text NOT NULL,
	`entered_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `feature_flag_mirror` (
	`flag_key` text PRIMARY KEY NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`state` text DEFAULT '{}' NOT NULL,
	`last_changed_by` text NOT NULL,
	`last_changed_at` integer NOT NULL,
	`last_change_reason` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `funnel_definitions` (
	`funnel_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`steps` text NOT NULL,
	`window_hours` integer NOT NULL,
	`scope` text NOT NULL,
	`owner` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `funnel_results_daily` (
	`funnel_id` text NOT NULL,
	`cohort_date` integer NOT NULL,
	`step_index` integer NOT NULL,
	`dims` text DEFAULT '{}' NOT NULL,
	`entered` integer DEFAULT 0 NOT NULL,
	`completed` integer DEFAULT 0 NOT NULL,
	`conversion_pct` real DEFAULT 0 NOT NULL,
	`median_hours_to_step` real DEFAULT 0 NOT NULL,
	PRIMARY KEY(`funnel_id`, `cohort_date`, `step_index`, `dims`)
);
--> statement-breakpoint
CREATE INDEX `funnel_results_by_funnel` ON `funnel_results_daily` (`funnel_id`);--> statement-breakpoint
CREATE TABLE `fx_rates` (
	`date` integer NOT NULL,
	`currency` text NOT NULL,
	`usd_rate` real DEFAULT 1 NOT NULL,
	PRIMARY KEY(`date`, `currency`)
);
--> statement-breakpoint
CREATE TABLE `gdpr_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`account_id` text,
	`user_id` text,
	`received_at` integer NOT NULL,
	`deadline_at` integer NOT NULL,
	`status` text NOT NULL,
	`steps` text DEFAULT '[]' NOT NULL,
	`completed_at` integer
);
--> statement-breakpoint
CREATE INDEX `gdpr_by_status` ON `gdpr_requests` (`status`);--> statement-breakpoint
CREATE TABLE `identity_map` (
	`anonymous_id` text NOT NULL,
	`user_id` text NOT NULL,
	`merged_at` integer NOT NULL,
	`source` text NOT NULL,
	PRIMARY KEY(`anonymous_id`, `user_id`)
);
--> statement-breakpoint
CREATE INDEX `identity_map_by_user` ON `identity_map` (`user_id`);--> statement-breakpoint
CREATE TABLE `ingest_dead_letter` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`payload` text NOT NULL,
	`error` text NOT NULL,
	`received_at` integer NOT NULL,
	`replayed_at` integer
);
--> statement-breakpoint
CREATE TABLE `llm_cost_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`occurred_at` integer NOT NULL,
	`account_id` text NOT NULL,
	`engine` text NOT NULL,
	`feature` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`tokens_in` integer DEFAULT 0 NOT NULL,
	`tokens_out` integer DEFAULT 0 NOT NULL,
	`cost_source` text NOT NULL,
	`unit_price_version` integer DEFAULT 1 NOT NULL,
	`cost_usd_microcents` integer DEFAULT 0 NOT NULL,
	`run_id` text
);
--> statement-breakpoint
CREATE INDEX `ledger_by_account_time` ON `llm_cost_ledger` (`account_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `ledger_by_engine_time` ON `llm_cost_ledger` (`engine`,`occurred_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `ledger_unique_run_feature` ON `llm_cost_ledger` (`run_id`,`feature`);--> statement-breakpoint
CREATE TABLE `metric_rollup_daily` (
	`metric_key` text NOT NULL,
	`date_reporting_tz` integer NOT NULL,
	`dims` text DEFAULT '{}' NOT NULL,
	`value` real DEFAULT 0 NOT NULL,
	`numerator` real DEFAULT 0 NOT NULL,
	`denominator` real DEFAULT 0 NOT NULL,
	`computed_at` integer NOT NULL,
	`definitions_version` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`metric_key`, `date_reporting_tz`, `dims`)
);
--> statement-breakpoint
CREATE INDEX `rollup_d_by_key` ON `metric_rollup_daily` (`metric_key`);--> statement-breakpoint
CREATE INDEX `rollup_d_by_date` ON `metric_rollup_daily` (`date_reporting_tz`);--> statement-breakpoint
CREATE TABLE `metric_rollup_hourly` (
	`metric_key` text NOT NULL,
	`hour_utc` integer NOT NULL,
	`dims` text DEFAULT '{}' NOT NULL,
	`value` real DEFAULT 0 NOT NULL,
	`numerator` real DEFAULT 0 NOT NULL,
	`denominator` real DEFAULT 0 NOT NULL,
	`computed_at` integer NOT NULL,
	`definitions_version` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`metric_key`, `hour_utc`, `dims`)
);
--> statement-breakpoint
CREATE INDEX `rollup_h_by_key` ON `metric_rollup_hourly` (`metric_key`);--> statement-breakpoint
CREATE TABLE `model_prices` (
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`valid_from` integer NOT NULL,
	`input_price_per_mtok_usd_microcents` integer DEFAULT 0 NOT NULL,
	`output_price_per_mtok_usd_microcents` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`provider`, `model`, `valid_from`)
);
--> statement-breakpoint
CREATE TABLE `nps_responses` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`account_id` text,
	`score` integer NOT NULL,
	`comment` text,
	`surveyed_at` integer NOT NULL,
	`source` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `nps_by_time` ON `nps_responses` (`surveyed_at`);--> statement-breakpoint
CREATE INDEX `nps_by_account` ON `nps_responses` (`account_id`);--> statement-breakpoint
CREATE TABLE `ops_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pipeline_runs` (
	`run_id` text PRIMARY KEY NOT NULL,
	`scheduled_for` integer NOT NULL,
	`account_id` text NOT NULL,
	`workspace_id` text,
	`engine` text NOT NULL,
	`prompt_id` text NOT NULL,
	`started_at` integer,
	`finished_at` integer,
	`status` text NOT NULL,
	`failure_class` text,
	`skip_cause` text,
	`latency_ms` integer DEFAULT 0 NOT NULL,
	`retries` integer DEFAULT 0 NOT NULL,
	`tokens_in` integer DEFAULT 0 NOT NULL,
	`tokens_out` integer DEFAULT 0 NOT NULL,
	`model` text DEFAULT '' NOT NULL,
	`cost_usd_microcents` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `runs_by_engine_time` ON `pipeline_runs` (`engine`,`scheduled_for`);--> statement-breakpoint
CREATE INDEX `runs_by_account_time` ON `pipeline_runs` (`account_id`,`scheduled_for`);--> statement-breakpoint
CREATE INDEX `runs_by_status` ON `pipeline_runs` (`status`);--> statement-breakpoint
CREATE TABLE `provider_invoices` (
	`provider` text NOT NULL,
	`month` text NOT NULL,
	`amount_usd_cents` integer DEFAULT 0 NOT NULL,
	`entered_by` text NOT NULL,
	`entered_at` integer NOT NULL,
	PRIMARY KEY(`provider`, `month`)
);
--> statement-breakpoint
CREATE TABLE `reconciliation_issues` (
	`id` text PRIMARY KEY NOT NULL,
	`date` integer NOT NULL,
	`domain` text NOT NULL,
	`account_id` text,
	`expected_usd_cents` integer DEFAULT 0 NOT NULL,
	`actual_usd_cents` integer DEFAULT 0 NOT NULL,
	`delta_usd_cents` integer DEFAULT 0 NOT NULL,
	`status` text NOT NULL,
	`opened_at` integer NOT NULL,
	`resolved_at` integer
);
--> statement-breakpoint
CREATE INDEX `recon_by_status` ON `reconciliation_issues` (`status`);--> statement-breakpoint
CREATE TABLE `scraper_health_states` (
	`engine` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`detector_context` text DEFAULT '' NOT NULL,
	`changed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `staff_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text,
	`role` text DEFAULT 'analyst' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`last_login_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `staff_users_email_unique` ON `staff_users` (`email`);--> statement-breakpoint
CREATE TABLE `stripe_balance_txns` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`account_id` text,
	`amount_usd_cents` integer DEFAULT 0 NOT NULL,
	`fee_usd_cents` integer DEFAULT 0 NOT NULL,
	`occurred_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `balance_txns_by_time` ON `stripe_balance_txns` (`occurred_at`);--> statement-breakpoint
CREATE TABLE `stripe_invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`amount_usd_cents` integer DEFAULT 0 NOT NULL,
	`fee_usd_cents` integer DEFAULT 0 NOT NULL,
	`status` text NOT NULL,
	`paid_at` integer,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`next_payment_attempt` integer,
	`days_delinquent` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `invoices_by_account` ON `stripe_invoices` (`account_id`);--> statement-breakpoint
CREATE INDEX `invoices_by_status` ON `stripe_invoices` (`status`);--> statement-breakpoint
CREATE TABLE `subscription_events` (
	`id` text PRIMARY KEY NOT NULL,
	`occurred_at` integer NOT NULL,
	`account_id` text NOT NULL,
	`subscription_id` text NOT NULL,
	`type` text NOT NULL,
	`source` text NOT NULL,
	`mrr_delta_usd_cents` integer DEFAULT 0 NOT NULL,
	`from_plan` text,
	`to_plan` text,
	`stripe_event_id` text,
	`raw` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `subevents_by_account_time` ON `subscription_events` (`account_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `subevents_by_type_time` ON `subscription_events` (`type`,`occurred_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `subevents_stripe_event_unique` ON `subscription_events` (`stripe_event_id`);--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`status` text NOT NULL,
	`plan_tier` text NOT NULL,
	`interval` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`mrr_usd_cents` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`trial_start` integer,
	`trial_end` integer,
	`current_period_start` integer,
	`current_period_end` integer,
	`canceled_at` integer,
	`cancel_reason_code` text,
	`synced_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `subscriptions_by_account` ON `subscriptions` (`account_id`);--> statement-breakpoint
CREATE INDEX `subscriptions_by_status` ON `subscriptions` (`status`);--> statement-breakpoint
CREATE TABLE `support_tickets_mirror` (
	`ticket_id` text PRIMARY KEY NOT NULL,
	`source_tool` text NOT NULL,
	`account_id` text,
	`user_id` text,
	`status` text NOT NULL,
	`priority` text NOT NULL,
	`created_at` integer NOT NULL,
	`first_response_minutes` integer,
	`resolved_at` integer,
	`csat_score` integer,
	`tags` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `tickets_by_account` ON `support_tickets_mirror` (`account_id`);--> statement-breakpoint
CREATE INDEX `tickets_by_status` ON `support_tickets_mirror` (`status`);--> statement-breakpoint
CREATE INDEX `tickets_by_created` ON `support_tickets_mirror` (`created_at`);--> statement-breakpoint
CREATE TABLE `sync_watermarks` (
	`source` text PRIMARY KEY NOT NULL,
	`last_synced_at` integer NOT NULL,
	`last_id` text,
	`rows_last_run` integer DEFAULT 0 NOT NULL,
	`lag_seconds` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `usage_events` (
	`event_id` text PRIMARY KEY NOT NULL,
	`event_name` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`received_at` integer NOT NULL,
	`account_id` text,
	`user_id` text,
	`anonymous_id` text,
	`session_id` text,
	`source` text NOT NULL,
	`lane` text DEFAULT 'posthog' NOT NULL,
	`schema_version` integer DEFAULT 1 NOT NULL,
	`properties` text DEFAULT '{}' NOT NULL,
	`is_impersonated` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX `events_by_name_time` ON `usage_events` (`event_name`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `events_by_account_time` ON `usage_events` (`account_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `events_by_user_time` ON `usage_events` (`user_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role_in_account` text NOT NULL,
	`is_internal` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`last_seen_at` integer,
	`deleted_at` integer,
	`synced_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `users_by_account` ON `users` (`account_id`);--> statement-breakpoint
CREATE INDEX `users_by_email` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`client_name` text NOT NULL,
	`created_at` integer NOT NULL,
	`prompt_count` integer DEFAULT 0 NOT NULL,
	`engines_enabled` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `workspaces_by_account` ON `workspaces` (`account_id`);