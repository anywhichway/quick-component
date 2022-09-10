# quick-component
A small utility for rapidly creating remotely loadable, on-demand, isolatable web components

# Usage

The easiest way to use `@anywhichway/quick-component` is to load both it and the component it is using from a CDN, e.g.

```html
<script src="https://cdn.jsdelivr.net/npm/@anywhichway/quick-component.js@0.0.5" 
        component="https://cdn.jsdelivr.net/npm/@anywhichway/repl-host@0.0.3"></script>
```

By default, the tag name will be the file or terminal directory name of the component without a version number. You can
provide an alternate tag with the 'as' attribute:

```html
<script src="https://cdn.jsdelivr.net/npm/@anywhichway/quick-component.js@0.0.5" 
        component="https://cdn.jsdelivr.net/npm/@anywhichway/repl-host@0.0.3" 
        as="hosted-repl"></script>
```

# Defining Components

To be written.

# Version History (reverse chronological order)

2022-09-10 v0.0.5 Added documentation and better support for loading both module and regular script based components.

