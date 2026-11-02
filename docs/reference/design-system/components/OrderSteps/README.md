# OrderSteps

A thin progress line that shows where a lab order is: Ordered, Paid, Sample taken, Results in.

**Consumer provides:** the steps and the current step, plus the due date as an eyebrow above.

- 2px segments: done in `secondary`, current half filled, ahead in `surface-border`. Labels 12px; done and current in `content`.
- Use on the patient home card and order cards. The clinic portal shows the same stages as pipeline columns.
