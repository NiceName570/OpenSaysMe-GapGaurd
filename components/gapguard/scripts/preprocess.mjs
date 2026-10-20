const ENVIRONMENT = Object.freeze({ env_chromium: true, env_mv3: true, env_firefox: false, env_safari: false,
  env_mobile: false, ext_ubol: false, cap_html_filtering: false, cap_ipaddress: false });

// No eval. Unsupported future expressions fail the build instead of selecting
// both browser-specific branches by accidentally stripping comment directives.
export async function preprocess(content, resolveInclude = async () => { throw new Error('Unexpected include'); }) {
  const stack = [];
  let active = true;
  const output = [];
  for (const line of content.split(/\r?\n/)) {
    if (line.startsWith('!#if ')) {
      const expression = line.slice(5).trim();
      const match = expression.match(/^(!?)([a-z0-9_]+)$/);
      if (!match || !Object.hasOwn(ENVIRONMENT, match[2])) throw new Error(`Unsupported filter condition: ${expression}`);
      const condition = match[1] ? !ENVIRONMENT[match[2]] : ENVIRONMENT[match[2]];
      stack.push({ parent: active, condition, hasElse: false });
      active = active && condition;
    } else if (line.trim() === '!#else') {
      const frame = stack.at(-1);
      if (!frame || frame.hasElse) throw new Error('Unmatched filter else');
      frame.hasElse = true; active = frame.parent && !frame.condition;
    } else if (line.trim() === '!#endif') {
      const frame = stack.pop();
      if (!frame) throw new Error('Unmatched filter endif');
      active = frame.parent;
    } else if (active && line.startsWith('!#include ')) {
      output.push(await resolveInclude(line.slice(10).trim()));
    } else if (active) output.push(line);
  }
  if (stack.length) throw new Error('Unclosed filter condition');
  return output.join('\n');
}
