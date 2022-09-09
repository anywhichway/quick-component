async function importComponent(url, options={}) {
    url = new URL(url, document.baseURI);
    let as = options.as;
    const filename = url.pathname.split("/").pop();
    if(!as) {
        const parts = filename.split(".");
        as = parts[parts.length - 2];
        if(!as) as = parts[parts.length-1];
    }
    if(!filename.includes(".")) {
        let pathname = url.pathname;
        if(!pathname.endsWith("/")) pathname += "/";
        pathname += "index.html";
        url = new URL(pathname,url);
    }
    if (!as.includes("-")) as = "x-" + as;
    const response = await fetch(url),
        html = await response.text();
    return await quickComponent({html,...options,as,href:url.href});
}
async function quickComponent(options) {
    let {html,as,href,mode="open",isolate,isolated,allow="",referrerpolicy="",sandbox="",} = options;
    let dom = html;
    if(typeof(html)==="string") dom = new DOMParser().parseFromString(html, "text/html");
    if(options.import) {
        for(let el of [...dom.head.children]) {
            if(options.import.some((pattern) => {
                return el.matches(pattern);
            })) {
                if(el.tagName==="SCRIPT") {
                    const node = document.createElement("script");
                    [...el.attributes].forEach((attr) => node.setAttribute(attr.name,attr.value));
                    if(el.hasAttribute("src")) node.setAttribute("src",new URL(el.getAttribute("src"),href));
                    node.innerHTML = el.innerText;
                    el = node;
                } else if(el.tagName==="LINK") {
                    const node = document.createElement("link");
                    [...el.attributes].forEach((attr) => node.setAttribute(attr.name,attr.value));
                    if(el.hasAttribute("href")) node.setAttribute("href",new URL(el.getAttribute("href"),href));
                    el = node;
                }
                if(["src","href"].some((attributeName) => el.hasAttribute(attributeName))) {
                    await new Promise((resolve) => {
                        el.addEventListener("load", () => resolve());
                        document.head.appendChild(el);
                    })
                } else {
                    document.head.appendChild(el);
                }
            }
        }
    }
    [...dom.body.querySelectorAll('script[src^="."]')].forEach((script) => {
        script.setAttribute("src",new URL(script.getAttribute("src"),href).href);
    });
    const instances = new Set(),
        observedAttributes = new Set(),
        reactiveAttributes = new Set(),
        sharedAttributes = new Set(),
        importedAttributes = new Set();
    let currentNode, scripts;
    class CustomElement extends HTMLElement {
        static get tagName() { return as.toUpperCase(); }
        constructor() {
            super();
            instances.add(this);
            this.attachShadow({mode:"open"});
            this.shadowRoot.innerHTML = dom.body.innerHTML;
            window.currentComponent = this;
            if(!scripts) {
                scripts = [];
                [...this.shadowRoot.querySelectorAll("script")].forEach((script,index) => {
                    const node = document.createElement("script");
                    [...script.attributes].forEach((attr) => node.setAttribute(attr.name,attr.value));
                    if(node.hasAttribute("src") || node.hasAttribute("async")) {
                        node.innerHTML = script.innerText;
                        scripts.push({script,replacement:node});
                    } else {
                        const vartype = script.getAttribute("type")==="module" ? "const" : "var";
                        let vars = `const as = "${as}", self = window.currentComponent;`;
                        node.innerHTML = `(() => { const as = "${as}", self = window.currentComponent; ${script.innerText} })()`;
                        scripts.push({script,replacement:node});
                    }
                });
            }
            if(options.isolated) {
                let ownerWindow;
                const mutationObserver = new MutationObserver(() => {
                    const {height,width} = document.body.getBoundingClientRect();
                    if(ownerWindow) ownerWindow.postMessage(JSON.stringify(["resize",{width,height}]),"*");
                });
                mutationObserver.observe(document.body,{ attributes: true, childList: true, characterData: true });
                window.addEventListener("message",async (event) => {
                    ownerWindow = event.source;
                    const data = event.data;
                    if(data) {
                        const f = new Function("return " + data)();
                        await f.call(el);
                        setTimeout(() => {
                            const {height,width} = document.body.getBoundingClientRect();
                            ownerWindow.postMessage(JSON.stringify(["resize",{width,height}]),"*");
                        },100);
                    }
                });
                ["click","dblclick"].forEach((type) => {
                    window.addEventListener("dblclick",(event) => {
                        const {view,detail,screenX,screenY,clientX,clientY,ctrlKey,shiftKey,altKey,metaKey,button,buttons} = event,
                            options = {detail,screenX,screenY,clientX,clientY,ctrlKey,shiftKey,altKey,metaKey,button,buttons};
                        ownerWindow.postMessage(JSON.stringify(["postEvent","MouseEvent",event.type,options]),"*");
                    });
                });
            }
        }
        adoptedCallback() {
            if(this.adopted) this.adopted();
        }
        attributeChangedCallback(name, oldValue, newValue) {
            if(this.attributeChanged) this.attributeChanged(name,oldValue,newValue);
        }
        compile(node,root=node) {
            const proxy = new Proxy(this,{
                get(target,name) {
                    const value = target[name],
                        vtype = typeof(value);
                    if(!node.quickCompiled && typeof(name)!=="symbol" && vtype!=="function") {
                        target.#monitorProperties(() => node.render(),[name]);
                    }
                    return vtype==="function" ? value.bind(target) : value;
                }
            });
            if(node.nodeType===Node.TEXT_NODE) {
                if(node.textContent.includes("${")) {
                    const template = node.textContent
                    node.render = (value) => {
                        const el = document.activeElement;
                        //selectionStart = el ? el.selectionStart : null,
                        //selectionEnd = el ? el.selectionEnd : null;
                        try {
                            currentNode = node;
                            (new Function("proxy","currentNode","with(proxy) { currentNode.textContent = `" + (value!=null ? value : template) + "`; }"))(proxy,node);
                        } catch(e) {

                        }
                        //if(el && selectionStart!=null && el.setSelectionRange) {
                        //    el.setSelectionRange(selectionStart,selectionEnd);
                        //}
                        if(root.rendered) root.rendered();
                    }
                    node.render();
                }
            } else if(node.nodeType===Node.ATTRIBUTE_NODE) {
                if(node.value?.includes("${")) {
                    const template = node.value
                    node.render = (value) => {
                        const el = document.activeElement;
                        //selectionStart = el ? el.selectionStart : null,
                        //selectionEnd = el ? el.selectionEnd : null;
                        try {
                            currentNode = node;
                            (new Function("proxy","currentNode","with(proxy) { currentNode.value = `" + (value!=null ? value : template) + "`; }"))(proxy,node);
                        } catch(e) {

                        }
                        //if(el && selectionStart!=null && el.setSelectionRange) {
                        //    el.setSelectionRange(selectionStart,selectionEnd);
                        //}
                        if(root.rendered) root.rendered();
                    }
                    node.render();
                }
            } else if(node.nodeType === Node.ELEMENT_NODE) {
                if(node.tagName!=="SCRIPT") {
                    [...node.attributes].forEach((attr) => { this.compile(attr,root); });
                    [...node.childNodes||[]].forEach((node) => { this.compile(node,root); });
                }
            } else if(node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
                [...node.childNodes||[]].forEach((node) => { this.compile(node,root); });
            }
            node.quickCompiled = true;
        }
        async connectedCallback() {
            // process the scripts collected in the constructor
            let item;
            while(item = scripts.shift()) {
                const {script,replacement} = item;
                await new Promise((resolve) => {
                    if(script) script.replaceWith(replacement);
                    else this.appendChild(replacement);
                    if(replacement.hasAttribute("src") || replacement.hasAttribute("async")) {
                        replacement.addEventListener("load",() => {
                            replacement.remove();
                            resolve();
                        });
                    } else {
                        replacement.remove();
                        resolve();
                    }
                })
            }
            const instance = [...instances][0];
            if(instance) { // get shared values from another instance, all instances will be the same, so only need to access one
                sharedAttributes.forEach((attributeName) => {
                    this.setAttribute(attributeName,instance.getAttribute(attributeName));
                })
            }
            if(this.initialize) {
                this.initialize();
            }
            if(!this.render) { // developer did not provide a custom render, so string templates being used
                this.compile(this.shadowRoot,this);
            }
            let result;
            if(this.connected) { // call the connected function, if any, provided by developer
                result = this.connected();
            }
            await result; // await the connected result, if any, in case it is async
            const desc = Object.getOwnPropertyDescriptor(Element.prototype,"innerHTML");
            Object.defineProperty(this,"innerHTML",{
                set(value) {
                    desc.set.call(this,value);
                    if(this.render) {
                        const el = document.activeElement,
                            selectionStart = el ? el.selectionStart : null,
                            selectionEnd = el ? el.selectionEnd : null;
                        this.render();
                        if(el && selectionStart!=null && el.setSelectionRange) {
                            el.setSelectionRange(selectionStart,selectionEnd);
                        }
                        if(this.rendered) {
                            this.rendered();
                        }
                    }
                    return true;
                },
                get() {
                    return desc.get.call(this);
                },
                configurable: true
            });
            this.#reactiveCallback(); // try reactive callbacks, primarily rendering
        }
        disconnectedCallback() {
            if(this.disconnected) {
                this.disconnected();
            }
        }
        exported(properties=[]) {
            if(!Array.isArray(properties)) {
                Object.entries(properties).forEach(([name,value]) => {
                    if(!this.hasAttribute(name)) this.setAttribute(name,typeof(value)==="string" ? value : JSON.stringify(value));
                    if(this[name]===undefined) this[name] = value;
                });
                properties = Object.keys(properties);
            }
            this.#monitorProperties((name,oldValue,newValue) => {
                this.setAttribute(name,newValue);
            },properties);
        }
        imported(attributes=[]) {
            if(!Array.isArray(attributes)) {
                Object.entries(attributes).forEach(([name,value]) => {
                    if(!this.hasAttribute(name)) this.setAttribute(name,typeof(value)==="string" ? value : JSON.stringify(value));
                });
                attributes = Object.keys(attributes);
            }
            const proto = Object.getPrototypeOf(this),
                self = this;
            attributes.forEach((name) => {
                Object.defineProperty(proto,name,{configurable:true,enumerable:true,get() {
                        let value = self.getAttribute(name);
                        try {
                            value = JSON.parse(value);
                        } catch(e) {

                        }
                        return value;
                    }})
            })
            this.#monitorAttributes(importedAttributes,attributes);
        }
        get isCustomElement() {
            return true;
        }
        #monitorAttributes(attributeNames,monitor) {
            monitor.forEach((attributeName) => {
                attributeNames.add(attributeName);
            })
        }
        #monitorProperties(callback,monitor) {
            const proto = Object.getPrototypeOf(this);
            monitor.forEach((propertyName) => {
                const desc = Object.getOwnPropertyDescriptor(proto,propertyName)||{value:this[propertyName],configurable:true};
                Object.defineProperty(proto,propertyName,{
                    get() {
                        return desc.get ? desc.get() : desc.value;
                    },
                    set(value) {
                        const oldValue = desc.get ? desc.get() : desc.value;
                        if(desc.set) desc.set(value)
                        else desc.value = value;
                        callback(propertyName,oldValue,value);
                    },
                    configurable: true
                })
            })
        }
        observed({attributes=[],properties=[]}) {
            this.#monitorAttributes(observedAttributes,attributes);
            this.#monitorProperties(propertyChangedCallback.bind(this),properties);
        }
        properties(props={}) {
            Object.entries(props).forEach(([key,value]) => {
                CustomElement.prototype[key] = value;
            });
        }
        #propertyChangedCallback(name, oldValue, newValue) {
            if(this.propertyChanged) this.propertyChanged(name,oldValue,newValue);
        }
        reactive({attributes=[],properties=[]}) {
            this.#monitorAttributes(reactiveAttributes,attributes);
            this.#monitorProperties(this.#reactiveCallback.bind(this),properties);
        }
        async #reactiveCallback() {
            if(this.render) { // call render if provided by developer
                const el = document.activeElement,
                    //selectionStart = el ? el.selectionStart : null,
                    //selectionEnd = el ? el.selectionEnd : null;
                    html = await this.render();
                if(html) {
                    while(this.shadowRoot.lastChild) this.shadowRoot.lastChild.remove();
                    const type = typeof(html);
                    if(type==="object") {
                        if(html instanceof DocumentFragment) {
                            const el = html.body || html;
                            while(el.firstChild) this.shadowRoot.appendChild(el.firstChild);
                        } else if(html instanceof HTMLElement) {
                            this.shadowRoot.appendChild(html);
                        } else {
                            this.shadowRoot.innerText = JSON.stringify(html);
                        }
                    } else {
                        this.shadowRoot.innerHTML = html;
                    }
                    //if(el && selectionStart!=null && el.setSelectionRange) {
                    //   el.setSelectionRange(selectionStart,selectionEnd);
                    //}
                    if(this.rendered) this.rendered();
                }
            }
        }
        #sharedCallback(name,oldValue,newValue) {
            instances.forEach((instance) => {
                instance[name] = newValue;
            })
        }
        setAttribute(name,value) {
            const oldValue = this.getAttribute(name);
            if(oldValue!==value && value!==undefined) {
                super.setAttribute(name,value);
                if(observedAttributes.has(name) ||  CustomElement.observedAttributes.has(name)) {
                    this.attributeChangedCallback(name,oldValue,value);
                }
                if(reactiveAttributes.has(name)) this.#reactiveCallback();
                if(sharedAttributes.has(name)) {
                    if(isolated) {
                        window.postMessage(JSON.stringify(["shareAttribute",name,value]),"*");
                    } else {
                        instances.forEach((instance) => {
                            instance.setAttribute(name,value);
                        })
                    }
                }
                if(isolated) window.postMessage(JSON.stringify(["setAttribute",name,value]),"*");
            }
        }
        shared({attributes=[],properties=[]}) {
            monitorAttributes(sharedAttributes,attributes);
            monitorProperties(sharedCallback.bind(this),properties);
        }
        until(promise,string) {
            const node = currentNode,
                type = node.nodeType;
            promise.then((value) => {
                if(type===Node.ATTRIBUTE_NODE) node.value = value;
                else if(type==Node.TEXT_NODE) node.textContent = value;
                else if(type===Node.ELEMENT_NODE) node.innerHTML = value;
            });
            return string;
        }
        async forEach(items,render) {
            const node = currentNode,
                parser = new DOMParser(),
                el = node.ownerElement || node;
            el.forEach ||= render || new Function("element","index","array","component","with(component) { const currentComponent = this; return `" + el.innerHTML + "`; }");
            el.normalize();
            items.forEach(async (item,i) => {
                let value = await el.forEach(item,i,items,this);
                if(typeof(value)==="string") value = parser.parseFromString(value,"text/html").body.firstChild;
                value.normalize();
                if(i<el.childNodes.length) el.childNodes[i].replaceWith(value);
                else el.appendChild(value);
            });
            while(el.childNodes.length>items.length) el.lastChild.remove();
        }
    }
    CustomElement.observedAttributes = new Set();
    let result;
    if(isolate) {
        class CustomElementIsolate extends HTMLElement {
            constructor() {
                super();
                instances.add(this);
                this.attachShadow({mode:"open"});
                const desc = Object.getOwnPropertyDescriptor(Element.prototype,"innerHTML");
                Object.defineProperty(this,"innerHTML",{
                    set(value) {
                        desc.set.call(this,value);
                        this.shadowRoot.firstElementChild.contentWindow.postMessage(`function() { this.innerHTML = '${value}'; }`,"*");
                        return true;
                    },
                    get() {
                        return desc.get.call(this);
                    },
                    configurable: true
                });
                const iframe = document.createElement("iframe"),
                    src = new URL(quickComponent.src,window.location).href,
                    text = `<!DOCTYPE html>
<html><head><base href="${window.location.href}"></head>
<body>
<script src="${src}"></script>
<script>
importComponent('${href}',{as:'${as}',isolated:true});
const style = document.body.style;
style.padding = "0px";
style.marginTop = "3px";
style.marginLeft = "0px";
style.overflow = "hidden";
style.width = "fit-content";
style.height = "fit-content";
const el = document.createElement("${as}");
el.innerHTML = this.innerHTML;
el.style.width = "fit-content";
el.style.height = "fit-content";
el.isolated = true;
document.body.appendChild(el);
</script>
</body>
</head>`;
                iframe.setAttribute("srcdoc",text);
                if(sandbox && !sandbox.includes("allow-downloads-without-user-activation")) {
                    if(!sandbox.includes("allow-scripts")) sandbox += " allow-scripts";
                    iframe.setAttribute("sandbox",sandbox);
                }
                if(referrerpolicy) iframe.setAttribute("referrerpolicy",referrerpolicy);
                if(allow) iframe.setAttribute("allow",allow);

                //iframe.setAttribute("sandbox","allow-scripts");
                const style = iframe.style;
                style.display = "none";
                style.border = "none";
                style.padding = "0px";
                style.margin = "0px";
                style.overflow = "hidden";
                this.shadowRoot.appendChild(iframe);
                window.addEventListener("message",({source,data}) => {
                    if(source==iframe.contentWindow && data) {
                        const [fname,...args] = JSON.parse(data);
                        this[fname](...args);
                    }
                });
                setTimeout(() => {
                    this.shadowRoot.firstElementChild.style.display = "";
                    this.shadowRoot.firstElementChild.contentWindow.postMessage(`function(){ this.innerHTML = "${this.innerHTML}"; }`,"*");
                },100);
            }
            get isCustomElement() {
                return true;
            }
            resize({width,height}) {
                if(width!=null) this.shadowRoot.firstElementChild.style.width = width+"px";
                if(height!=null) this.shadowRoot.firstElementChild.style.height = height+"px";
            }
            setAttribute(name,value) {
                const oldValue = this.getAttribute(name);
                if(value!=undefined && oldValue!==value+"") {
                    super.setAttribute(name,value);
                    this.shadowRoot.firstElementChild.contentWindow.postMessage(`function() { this.setAttribute("${name}","${value}"); }`,"*");
                }
            }
            postEvent(eventClass,eventType,options) {
                const event = new Function(`return new ${eventClass}('${eventType}',${JSON.stringify(options)})`)();
                this.dispatchEvent(event);
            }
        }
        result = CustomElementIsolate
    } else {
        result = CustomElement;
    }
    customElements.define(as,result);
    return result;
}
quickComponent.src = document.currentScript.getAttribute("src");
if(document.currentScript.hasAttribute("component")) {
    importComponent(document.currentScript.getAttribute("component"),{as:document.currentScript.getAttribute("as")})
}