export function parseCommandLine(commandStr) {
    const trimmed = commandStr.trim();
    if (!trimmed) {
        throw new Error("Command string cannot be empty");
    }
    const tokens = [];
    const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
    let match;
    while ((match = regex.exec(trimmed)) !== null) {
        if (match[1] !== undefined) {
            tokens.push(match[1]);
        }
        else if (match[2] !== undefined) {
            tokens.push(match[2]);
        }
        else {
            tokens.push(match[0]);
        }
    }
    if (tokens.length === 0) {
        throw new Error("Command string cannot be empty");
    }
    return {
        command: tokens[0],
        args: tokens.slice(1),
    };
}
