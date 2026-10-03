export function parseCommandLine(commandStr) {
    const trimmed = commandStr.trim();
    if (!trimmed) {
        throw new Error("Command string cannot be empty");
    }
    const tokens = [];
    let currentToken = "";
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let isEscaped = false;
    let hasToken = false;
    for (let i = 0; i < trimmed.length; i++) {
        const char = trimmed[i];
        if (isEscaped) {
            currentToken += char;
            hasToken = true;
            isEscaped = false;
            continue;
        }
        if (char === "\\" && !inSingleQuote) {
            isEscaped = true;
            continue;
        }
        if (char === "'" && !inDoubleQuote) {
            inSingleQuote = !inSingleQuote;
            hasToken = true;
            continue;
        }
        if (char === '"' && !inSingleQuote) {
            inDoubleQuote = !inDoubleQuote;
            hasToken = true;
            continue;
        }
        if (/\s/.test(char) && !inSingleQuote && !inDoubleQuote) {
            if (hasToken) {
                tokens.push(currentToken);
                currentToken = "";
                hasToken = false;
            }
            continue;
        }
        currentToken += char;
        hasToken = true;
    }
    if (inSingleQuote || inDoubleQuote) {
        throw new Error("Unclosed quote in command string");
    }
    if (isEscaped) {
        currentToken += "\\";
        hasToken = true;
    }
    if (hasToken) {
        tokens.push(currentToken);
    }
    if (tokens.length === 0) {
        throw new Error("Command string cannot be empty");
    }
    return {
        command: tokens[0],
        args: tokens.slice(1),
    };
}
