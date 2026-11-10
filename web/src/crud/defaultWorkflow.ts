/** Process name for org workflow steps when none is chosen. Kept in its own
 * module so non-hook code (e.g. saveOrgWorkflowSteps) can import it without
 * pulling the useOrgWorkflowSteps import graph into Jest. */
export const defaultWorkflow = 'draft';
