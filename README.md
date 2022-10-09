# quick-component
A small utility for rapidly creating remotely loadable, on-demand, isolatable web components

# Script Tag Usage

The easiest way to use `@anywhichway/quick-component` is to load both it and the component it is using from a CDN, e.g.

```html
<script src="https://cdn.jsdelivr.net/npm/@anywhichway/quick-component.j" 
        component="https://cdn.jsdelivr.net/npm/@anywhichway/repl-host@0.0.4"></script>
```

If you are using JSDelivr, by default the tag name will be the file or terminal directory name of the component without a version number. Component versioning is 
currently only supported for JSDeliver.

You can provide an alternate tag with the 'as' attribute:

```html
<script src="https://cdn.jsdelivr.net/npm/@anywhichway/quick-component.js@0.0.5" 
        component="https://cdn.jsdelivr.net/npm/@anywhichway/repl-host@0.0.3" 
        as="hosted-repl"></script>
```

These additional attributes are available:

`import` - An array of CSS selectors that allow importing component elements into the head of the
requesting document. This is sometimes necessary to support styling or JavaScript libraries that
were not necessarily designed to run in a shadowDOM. If import is not specified it defaults to
`["link","style","script"]`.

`isolate` - Takes the value "true" or "false". The value "true" places the actual contents of the
component into an iframe and creates a proxy around the iframe to support automatic resizing.

If `isolate` is "true", you can configure the iframe security using the same attributes used by an iframe, i.e.
`allow`, `allowfullscren`, `allowpaymentrequest`, `referrerpolicy`, `csp`, `sandbox`. See
https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe. 

# API Usage

To be written.

# Defining Components

To be written.

# Version History (reverse chronological order)

2022-10-09 v0.0.11 Added support for subclassing standard HTML tags.

2022-09-25 v0.0.10 Optimized for third-party libraries loading.

2022-09-25 v0.0.9 Removed excess code. Eliminated memory leak from event handler.

2022-09-25 v0.0.8 Optimized to reduce frequency of loading component scripts.

2022-09-10 v0.0.7 Added support for imports then loading components via a script tag.

2022-09-10 v0.0.6 Ensure that components defined using `./index.js` do not cache the `./index.js` file since it needs
to be applied every time an element is created.

2022-09-10 v0.0.5 Added documentation and better support for loading both module and regular script based components.

