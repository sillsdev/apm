# **APM User Experience**

# **Principles and Findings**

* [https://www.nngroup.com/articles/ten-usability-heuristics/](https://www.nngroup.com/articles/ten-usability-heuristics/)  
* Users prefer visual data and direct interactivity with it.  
  * Avoid dealings via abstract representations, e.g. time ranges as numbers  
  * People don’t think in “modes” – if the data is visible, they will want to interact with it there  
* Show only what’s relevant. Show common actions, keep uncommon actions behind a menu.  
  * Use a single, standardized style of menu, e.g. three-dot, upper right  
  * A combination of icon and label accounts for accessibility. Use this when space allows  
* Keeping the minimum set of relevant data and actions shown allows users to maximize their focus and productivity.  
* Minimize color, so that onscreen color is effective and communicative  
  * Color is the first and primary means of attracting user attention  
  * Too much color overwhelms users and becomes meaningless and detracting  
    * Using dark colors as the app background is essentially excluded  
* People don’t read, at first. They only stop to read if you’ve already slowed them down, and even then they still might not.  
  * Minimize onscreen text. Condense sentences into shorter sentences, or even words, when possible. Use icons and colors.  
* Use the disabled state only when exceedingly obvious why the component is disabled  
  * Disabling buttons in unclear or ambiguous situations is confusing and frustrating  
  * Prefer allowing the action and then providing an indication why the action can’t be performed  
* 

# **Design Component Library**

This document outlines the standard components utilized by the APM design, detailing their sizes, states, and considerations for theming. It is intended to assist developers in defining a set of components for use during the design’s implementation. Establishing a consistent component library is crucial for maintaining a cohesive user experience and expediting development.

The goal here is to track and document components that are intended to be reused in execution across the application, other than the few “reserved” items. The design does not perfectly conform to the definitions below, whether due to the evolution of the design or the limitations of the wireframing software, so some judgment is needed when implementing. The primary intended use of this document is to conform the implemented components to these definitions.

# **Component Definitions and States**

Below is a detailed list of the core components, including their available states and sizing options.

## **Buttons**

Buttons facilitate user action and navigation. Text-based buttons can include icons, assuming they do not impact sizing.

| Component | State | Size | Notes |
| :---- | :---- | :---- | :---- |
| Text Button | Default/Enabled | Regular |  |
|  | Disabled | Regular |  |
|  | Primary | Regular |  |
|  | Toast | Regular | Different for Toast’s due to contrast |
|     ***(reserved)*** | Mode Enabled | Regular | Should be rare. An example is Add Passage |
| Pointy Button | Default/Enabled | Regular | Text Button with an arrow at one side |
|  | Primary | Regular |  |
| Row Button ***(reserved)*** | Default/Enabled | Large | Teams screen only |
| Card Button | Default/Enabled | Regular |  |
|  | Selected | Regular | E.g. Versions dialog |
| Icon | Default/Enabled | Regular |  |
|  | Disabled | Regular |  |
|  | Primary | Regular |  |
|  | Disabled | Small | Never to be used for standalone interaction |
|     ***(reserved)*** | *Default/Enabled* | *Large* | *Dialogs and header* |
|     ***(reserved)*** | *Disabled* | *Large* | *Accompanies titles* |
| Icon within Button ***(reserved)*** | *Default/Enabled* | *Regular* | *Use only when required (e.g. Discussions)* |
| Menu Icon | Default/Enabled | Regular | *An Icon whose function is to open a menu* |
| Attachment | Default/Enabled | Regular | Removable audio/text (e.g. Project Overview) |
| Floating Button | Default/Enabled | Regular |  |
| Record Icon | Default/Enabled | Large |  |
|  | Disabled | Large |  |
| Rerecord/Resume Button | Default/Enabled | Regular |  |
|  | Disabled | Regular |  |

## **Forms and Inputs**

These components are used for data entry and selection.

| Component | State | Size |
| :---- | :---- | :---- |
| Text Field | Default/Enabled |  |
|  | Disabled |  |
| Text Area | Default/Enabled |  |
|  | Disabled |  |
| Checkbox | Default/Enabled | Regular |
|  | Disabled | Regular |
|  | Default/Enabled | Large |
| Dropdown | Default/Enabled |  |
|  | Disabled |  |
| Text Field w/ Dropdown | Default/Enabled |  |
|  | Disabled |  |

## **Miscellaneous**

These components don’t strictly fit into the other categories but still need to be documented to aid in uniformity.

| Component | State | Notes |
| :---- | :---- | :---- |
| Expansion Container | Default/Enabled | E.g. Export and also Q\&A Preparation |
| Card Container | Default |  |
|  | Inactive/Darkened |  |
| Category Tag | N/A |  |

## **Typography**

Typography styles define the visual hierarchy of the primarily informative content.

| Component | Weight | Size |
| :---- | :---- | :---- |
| Label | Thin | Caption |
|  | Regular | Caption |
|  | Regular | Regular |
|  | Bold | Regular |
|  | Regular | Subheading |
|  | Regular | Heading |
| Label (gray) | Thin | Caption |
| Label (white) | Regular | Regular |
| Notification Badge | Regular | Regular |

# **Theming Considerations**

The visual design of each component (color, border, shadow, etc.) should be controlled by a centralized set of design tokens.

## **Key Theming Elements**

* **Color Palette:** Defines primary, secondary, accent, and semantic colors (success, warning, error, info). Component states (e.g., hover, active, disabled) must map to these semantic colors.  
* **Typography Scale:** The sizes and weights listed in the Typography section must be consistently mapped to theme tokens for easy global adjustment.  
* **Spacing:** Consistent use of spacing tokens ensures rhythm and balance between components. This and other specific aesthetic constraints are not listed here.
