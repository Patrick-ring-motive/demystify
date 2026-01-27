const acorn = require('acorn');
const walk = require('acorn-walk');
const { generate } = require('astring');

/**
 * renamingScopeAware: Detects name collisions across scopes
 * and appends numbers to ensure uniqueness.
 */
function solveShadowing(ast) {
  const globalNameCounts = {}; // Tracks how many times a name has been used overall
  const scopeStack = [{}]; // Stack of identifier mappings { "oldName": "newName" }

  walk.ancestor(ast, {
    // 1. Entering a new scope (Function or Block)
    // Note: In strict unminifying, every BlockStatement could be a scope (let/const)
    'FunctionDeclaration|FunctionExpression|ArrowFunctionExpression|BlockStatement'(
      node
    ) {
      scopeStack.push({});
    },

    // 2. Handle Declarations (Where the name is "born")
    VariableDeclarator(node, state, ancestors) {
      const name = node.id.name;
      const currentScope = scopeStack[scopeStack.length - 1];

      // If this name was already used globally or in an outer scope...
      if (globalNameCounts[name] !== undefined) {
        globalNameCounts[name]++;
        const newName = `${name}${globalNameCounts[name]}`;

        currentScope[name] = newName; // Register the mapping for this scope
        node.id.name = newName; // Rename the declaration
      } else {
        // First time seeing this name
        globalNameCounts[name] = 0;
        currentScope[name] = name;
      }
    },

    // 3. Handle References (Where the name is "used")
    Identifier(node, state, ancestors) {
      const parent = ancestors[ancestors.length - 2];

      // SAFETY: Use the check from our previous step to avoid renaming properties
      const isProperty =
        parent.type === 'MemberExpression' &&
        parent.property === node &&
        !parent.computed;
      const isObjectKey =
        parent.type === 'Property' && parent.key === node && !parent.shorthand;
      const isDeclaration =
        parent.type === 'VariableDeclarator' && parent.id === node;

      if (!isProperty && !isObjectKey && !isDeclaration) {
        // Look up the name in the scope stack (from inner to outer)
        for (let i = scopeStack.length - 1; i >= 0; i--) {
          if (scopeStack[i][node.name]) {
            node.name = scopeStack[i][node.name];
            break;
          }
        }
      }
    },

    // 4. Leaving a scope
    'FunctionDeclaration:exit|FunctionExpression:exit|ArrowFunctionExpression:exit|BlockStatement:exit'() {
      scopeStack.pop();
    },
  });

  return ast;
}

const fs = require('fs');

let code = String(fs.readFileSync('target.js'));
const astCode = acorn.parse(code, { ecmaVersion: 2020 });
code = generate(solveShadowing(astCode));
const getPairs = (code) => {
  let p = code
    .match(
      /(let|var|const|[,])\s+[A-Za-z0-9$_]{1,3}[0-9_]*\s*=\s*(['"]?[A-Za-z$_][A-Za-z0-9.$_]{3,})/g
    )
    .map((x) =>
      x
        .replace(/['"]+/g, '')
        .split('=')
        .map((y) => y.trim().split(/\s+/).pop())
    );
  p = p.filter(
    (x) =>
      p.findIndex((y) => x[0] == y[0]) === p.findLastIndex((z) => x[0] == z[0])
  );
  return p;
};
let pairs = getPairs(code).filter(
  (x) => x[1] !== 'function' && x[1][1] !== '.'
);
pairs.forEach((x) => {
  x[1] = x[1].replace(/\.(.)/g, (y) => y.replace('.', '').toUpperCase());
});
console.log(pairs);
let replacers = Object.fromEntries(pairs);
// Step 1: Parse the code into an AST
const ast = acorn.parse(code, { ecmaVersion: 2020 });

// Step 2: Walk and Modify the AST
// We define a recursive function to find "Identifier" nodes

function countNames(node, name, count = 0) {
  if (!node || typeof node !== 'object') return count;
  if (node.type === 'Identifier' && node.name === name) {
    return count + 1;
  }
  for (const key in node) {
    if (Array.isArray(node[key])) {
      node[key].forEach((child) => {
        count += countNames(child, name);
      });
    } else {
      count += countNames(node[key], name);
    }
  }
  return count;
}
const shortNames = {};
let lastName;
const notNames = [
  'function',
  'class',
  'type',
  'name',
  'key',
  'value',
  'get',
  'set',
  'let',
  'var',
  'const',
  'generator',
  'await',
  'for',
];

const isShort = x => /^[A-Za-z0-9$_]{1,2}[0-9_]*$/.test(x);


/**
 * Merged Refactor & Analysis Function
 * @param {Node} node - Current AST node
 * @param {string|null} oldName - The name to replace (null if just analyzing)
 * @param {string|null} newName - The new name (null if just analyzing)
 * @param {Node|null} parent - The parent of the current node
 */
function renameIdentifier(node, oldName, newName, parent = null) {
  if (!node || typeof node !== 'object') return;

  if (node.type === 'Identifier') {
    // --- SAFETY LOGIC: Determine if this is a "renamable" identifier ---

    // 1. Is it a property in a member expression? (e.g., the 'foo' in obj.foo)
    const isProperty =
      parent &&
      parent.type === 'MemberExpression' &&
      parent.property === node &&
      !parent.computed;

    // 2. Is it a key in an object literal? (e.g., the 'foo' in { foo: 1 })
    // We allow renaming if it's 'shorthand' (e.g., { foo }) because that refers to a variable.
    const isObjectKey =
      parent &&
      parent.type === 'Property' &&
      parent.key === node &&
      !parent.shorthand;

    // 3. Is it a function/method property name? (e.g. obj = { foo() {} })
    const isMethod =
      parent && parent.type === 'MethodDefinition' && parent.key === node;

    const isSafeToRename = !isProperty && !isObjectKey && !isMethod;

    // --- YOUR RENAMING LOGIC ---
    if (isSafeToRename && oldName && node.name === oldName) {
      node.name = newName;
    }

    // --- YOUR FREQUENCY ANALYSIS LOGIC ---
    if (!isShort(node.name) && !notNames.includes(node.name)) {
      lastName = node.name;
    } else {
      // Only track frequencies for short names if they are actual variable usages
      if (isSafeToRename) {
        shortNames[node.name] ??= {};
        shortNames[node.name][lastName] ??= 0;
        shortNames[node.name][lastName]++;
      }
    }
  }

  // --- RECURSION ---
  // We pass the current 'node' as the 'parent' for the next level
  for (const key in node) {
    if (Array.isArray(node[key])) {
      node[key].forEach((child) => {
        // Keep your lastName update logic for array children
        if (
          node.type === 'Identifier' &&
          !isShort(node.name) &&
          !notNames.includes(node.name)
        ) {
          lastName = node.name;
        }
        renameIdentifier(child, oldName, newName, node);
      });
    } else {
      // Keep your lastName update logic for object properties
      if (
        node.type === 'Identifier' &&
        !isShort(node.name) &&
        !notNames.includes(node.name)
      ) {
        lastName = node.name;
      }
      renameIdentifier(node[key], oldName, newName, node);
    }
  }
}
/*function renameIdentifier(node, oldName, newName, previous) {
  if (!node || typeof node !== 'object') return;

  // If we find an Identifier with the target name, swap it
  if (node.type === 'Identifier' && node.name === oldName) {
    node.name = newName;
  }

  if (node.type === 'Identifier') {
    if (node.name == 'bt') {
      console.log(node.name, lastName, countNames(ast, node.name));
    }
    if (node.name.length > 2 && !notNames.includes(node.name)) {
      lastName = node.name;
    } else {
      shortNames[node.name] ??= {};
      shortNames[node.name][lastName] ??= 0;
      shortNames[node.name][lastName]++;
    }
  }

  // Recursively check all child properties

  for (const key in node) {
    if (Array.isArray(node[key])) {
      node[key].forEach((child) => {
        if (
          node.type === 'Identifier' &&
          node.name?.length > 2 &&
          !notNames.includes(node.name)
        )
          lastName = node.name;
        renameIdentifier(child, oldName, newName, node);
      });
    } else {
      if (
        node.type === 'Identifier' &&
        node.name?.length > 2 &&
        !notNames.includes(node.name)
      )
        lastName = node.name;
      renameIdentifier(node[key], oldName, newName, node);
    }
  }
}*/

for (const key in replacers) {
  renameIdentifier(ast, key, `${replacers[key]}$${key}`);
}

code = generate(ast);

pairs = getPairs(code).filter((x) => x[1] !== 'function' && x[1][1] !== '.');

pairs.forEach((x) => {
  x[1] = x[1].replace(/\.(.)/g, (y) => y.replace('.', '').toUpperCase());
});

replacers = Object.fromEntries(pairs);
for (const key in replacers) {
  renameIdentifier(ast, key, `${replacers[key]}$${key}`);
}

code = generate(ast);

pairs = getPairs(code).filter((x) => x[1] !== 'function' && x[1][1] !== '.');

pairs.forEach((x) => {
  x[1] = x[1].replace(/\.(.)/g, (y) => y.replace('.', '').toUpperCase());
});

replacers = Object.fromEntries(pairs);
for (const key in replacers) {
  renameIdentifier(ast, key, `${replacers[key]}$${key}`);
}
// Step 3: Generate the new code

const getLongNames = () => {
  const names = {};
  for (const obj in shortNames) {
    let n = '';
    let x = 0;
    for (const key in shortNames[obj]) {
      if (shortNames[obj][key] > x) {
        n = key;
        x = shortNames[obj][key];
      }
    }
    names[obj] ??= [];
    for (const key in shortNames[obj]) {
      if (shortNames[obj][key] == x) {
        names[obj].push(key);
      }
    }
    if (/[A-Z]/.test(names[obj])) {
      names[obj] = names[obj].filter((x) => x != x.toLowerCase());
    }
    const len = Math.max(...names[obj].map((x) => x.length));
    names[obj] = names[obj].filter((x) => x.length == len);
    if (names[obj].length > 1) {
      const no$ = names[obj].filter((x) => !x.includes('$'));
      if (no$.length > 0) {
        names[obj] = no$;
      }
    }
  }
  return names;
};

const nameLists = getLongNames();
console.log(nameLists);
for (const key in nameLists) {
  renameIdentifier(ast, key, `${nameLists[key].join('$')}$${key}`);
}
const output = generate(ast)
  .replace(
    /([$a-zA-Z_]+[$a-zA-Z0-9_]*)\s*=\s*function\s*\(/g,
    '$1 = function __dollar_sign__$1('
  )
  .replace(
    /([$a-zA-Z_]+[$a-zA-Z0-9_]*)\s*:\s*function\s*\(/g,
    '$1 : function __dollar_sign__$1('
  )
  .replaceAll('__dollar_sign__', '$');
//console.log(getPairs(output));
fs.writeFileSync('result.js', output);
