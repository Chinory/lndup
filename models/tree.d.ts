type Path = string

interface DigestNode {
    [ino: string]: Path[]
}

interface ExkeyNode {
    [digest: string]: DigestNode
}

interface SizeNode {
    [exkey: string]: ExkeyNode
}

interface DevNode {
    [size: string]: SizeNode
}

interface Entry {
    [dev: string]: DevNode
}
