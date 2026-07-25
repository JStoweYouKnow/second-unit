-- Client-set "expected deliverables" per milestone.
-- The hirer describes what the artist must deliver for each milestone when
-- creating the project; the text is stored on the contract and applied to the
-- milestone rows when the contract activates (contract_milestones.description).
-- Run after contract-milestones.sql.

alter table contracts
  add column if not exists milestone_descriptions text[];

comment on column contracts.milestone_descriptions is
  'Hirer-authored expected deliverable per milestone (aligned to milestone_amounts / sort_order). Applied to contract_milestones.description at activation.';
