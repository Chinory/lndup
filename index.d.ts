import { ChildProcess } from "child_process";

type InoTable = { [ino: string]: string[] }
type DigestTable = { [digest: string]: InoTable }
type ExkeyTable = { [exkey: string]: DigestTable }
type SizeTable = { [size: string]: ExkeyTable }
type DevTable = { [dev: string]: SizeTable }

type HashWork = { size: number, digestTable: DigestTable, digest: string, ino: string }
export function getHashWorks (devTable: DevTable, dev: string): IterableIterator<HashWork>
export function finishHashWork (work: HashWork, digest: string): void

type LinkWork = { size: number, inoTable: InoTable, srcIno: string, dstInos: string[] }
export function getLinkWorks (devTable: DevTable, dev: string): IterableIterator<LinkWork>

type SizeCount = { size: number, count: number }
type SizeSrcDst = { size: number, src: number, dst: number }

export class Queue<T> {
    static create(refData: Array<T>): Queue<T>;
    static from(copyData: Array<T>): Queue<T>;
    enqueue(item: T): void;
    dequeue(def?: T): T;
}

interface MPHashChildProcess {
    works: Queue<{ size: number, callback: (err: string, digest: string) => void }>;
    errs: Queue<string>;
    proc: ChildProcess;
}
interface MPHashStats {
    hashInt: SizeCount;
    hashExt: SizeCount;
}
export class MPHash {
    static create(algorithm?: string, encoding?: string, localBufferSize?: number, childBufferSize?: number): MPHash;

    stats: MPHashStats;
    setStats(stats: MPHashStats): void;

    child: ChildProcess[];
    createChild(count: number): void;
    closeChild(i: number): MPHashChildProcess;
    
    hash(path: string, size: number, callback: (err: string, digest: string) => void, childIndex?: number): void;
}

type HashCallback = (err: string, digest: string) => void;
type HashFunction = (path: string, size: number, callback: HashCallback) => void;
