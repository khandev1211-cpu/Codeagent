---
name: form-validation
description: Implement client-side form validation with good UX. Use when building a form that needs validation feedback.
allowed-tools: read_file, write_file, edit_file
---

# Form Validation

- Validate on blur/submit for most fields, not on every keystroke — validating "email is invalid" while the user is still mid-typing their email is a common, genuinely annoying UX mistake.
- Show errors next to the specific field they apply to, not just a generic banner at the top — the user shouldn't have to guess which field is wrong.
- Clear an error as soon as the specific issue is fixed, without requiring a full resubmit, once the field has already been validated once.
- Client-side validation is a UX layer only — the same validation must also happen server-side (see `input-validation` skill), since client-side checks can always be bypassed.
- Disable the submit button while a submission is in flight, and give clear feedback on success/failure — a form that can be double-submitted, or that fails silently with no visible error, are both common real bugs.
- Match the project's existing form library/convention (React Hook Form, Formik, plain controlled inputs) rather than introducing a new pattern for one form.
