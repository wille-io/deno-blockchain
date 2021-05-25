import { existsSync } from "https://deno.land/std/fs/mod.ts";


export class Block
{
  constructor(id: number, data: Uint8Array)
  {
    this.id = id;
    this.data = data;
  }

  id: number;
  data: Uint8Array;
}


export class Blockchain
{
  bcidx: Deno.File;
  bcdb: Deno.File;
  idxPos: number;
  dbPos: number;

  constructor(directory: string, options: Deno.OpenOptions)
  {
    if (!existsSync(directory))
      throw("The directory '" + directory +"' does not exist!");

    const newDirPath: string = directory + "/" + "bcdb/";

    if (!existsSync(newDirPath))
      Deno.mkdirSync(newDirPath);
    
    this.bcidx = Deno.openSync(newDirPath + "idx", options);
    this.bcdb  = Deno.openSync(newDirPath + "data",  options);

    this.idxPos = Deno.seekSync(this.bcidx.rid, 0, Deno.SeekMode.End);
    this.dbPos  = Deno.seekSync(this.bcdb.rid, 0, Deno.SeekMode.End);
  }


  append(id: number, data: Uint8Array): void
  {
    // write data identifier to index
    {
      const indexIdBuf = new Uint8Array(4);
      const indexIdView = new DataView(indexIdBuf.buffer, 0);
      indexIdView.setUint32(0, id, true);
      this.idxPos += Deno.writeSync(this.bcidx.rid, indexIdBuf);
    }


    // write data size to index
    {
      const dataSize = data.length;
      //console.log("add: dataSize: " + dataSize);
      const dbSizeBuf = new Uint8Array(4);
      const dbSizeView = new DataView(dbSizeBuf.buffer, 0);
      dbSizeView.setUint32(0, dataSize, true);
      this.dbPos += Deno.writeSync(this.bcidx.rid, dbSizeBuf);
    }


    // write data to db
    this.dbPos += Deno.writeSync(this.bcdb.rid, data);
  }


  count(): number
  {
    const oldPos = this.idxPos;
    const pos = Deno.seekSync(this.bcidx.rid, 0, Deno.SeekMode.End);
    const ret = pos / 8; // one index consists of 4 bytes identifier and 4 bytes size => 8 bytes per index

    Deno.seekSync(this.bcidx.rid, oldPos, Deno.SeekMode.Start);

    return ret;
  }


  hasIndexById(id: number): boolean
  {
    const oldIdxPos = this.idxPos;

    Deno.seekSync(this.bcidx.rid, 0, Deno.SeekMode.Start); // seek to start (temporarily! seek to end at the end of this function)

    while (1)
    {
      // read the index identifier 
      const idxIdBuf = new Uint8Array(4); // read 4 bytes aka. 32 bits
      const actualReadBytes = Deno.readSync(this.bcidx.rid, idxIdBuf);

      if (actualReadBytes !== 4)
        break;

      const idxIdView = new DataView(idxIdBuf.buffer, 0);
      if (idxIdView.getUint32(0, true) == id) // little-endian
      {
        // reset file cursors to the state before call of this function
        Deno.seekSync(this.bcidx.rid, oldIdxPos, Deno.SeekMode.Start);
        return true;
      }

      Deno.seekSync(this.bcidx.rid, 4, Deno.SeekMode.Current); // skip size
    }

    
    // reset file cursors to the state before call of this function
    Deno.seekSync(this.bcidx.rid, oldIdxPos, Deno.SeekMode.Start);
    return false;
  }


  getByIndex(at: number): Block
  {
    // NOTE: read does increase the cusor
    const oldIdxPos = this.idxPos;
    const oldDbPos = this.dbPos;

    let currentAt = 0;
    let skipThisManyBytesInDb = 0;  // first entry

    Deno.seekSync(this.bcidx.rid, 0, Deno.SeekMode.Start); // seek to start (temporarily! seek to end at the end of this function)

    while (1)
    {
      // console.log("currentAt: " + currentAt);


      // read the index identifier 
      const idxIdBuf = new Uint8Array(4); // read 4 bytes aka. 32 bits
      let actualReadBytes = Deno.readSync(this.bcidx.rid, idxIdBuf);

      if (actualReadBytes !== 4)
        break;

      // only read id if it is needed (if the block was found)

          
      // get the db data size from this index (to know how many bytes to skip)
      const sizeBuffer = new Uint8Array(4);
      actualReadBytes = Deno.readSync(this.bcidx.rid, sizeBuffer);

      if (actualReadBytes !== 4)
        break;

      const sizeView = new DataView(sizeBuffer.buffer, 0);
      const dbSize = sizeView.getUint32(0, true);
      //console.log("("+currentAt+") dbSize = " + dbSize);


      if (currentAt === at) // if this is the wanted index by position
      {
        // get data from db
        const dbPos = Deno.seekSync(this.bcdb.rid, skipThisManyBytesInDb, Deno.SeekMode.Start); // go to index position in db

        if (dbPos != skipThisManyBytesInDb)
          break;

        const dbBuf = new Uint8Array(dbSize);
        actualReadBytes = Deno.readSync(this.bcdb.rid, dbBuf);

        if (actualReadBytes !== dbSize)
          break;

        const idxIdView = new DataView(idxIdBuf.buffer, 0);
        const id: number = idxIdView.getUint32(0, true); // little-endian

        
        // reset file cursors to the state before call of this function
        Deno.seekSync(this.bcidx.rid, oldIdxPos, Deno.SeekMode.Start);
        Deno.seekSync(this.bcdb.rid, oldDbPos, Deno.SeekMode.Start);
    
        //console.log("get: found, done!");
        return new Block(id, dbBuf);
      }


      // tell the next index to skip bytes in db
      skipThisManyBytesInDb += dbSize;


      // if not found yet ... skip this index
      currentAt++;
    }

    
    // reset file cursors to the state before call of this function
    Deno.seekSync(this.bcidx.rid, oldIdxPos, Deno.SeekMode.Start);
    Deno.seekSync(this.bcdb.rid, oldDbPos, Deno.SeekMode.Start);
    throw("out of bounds"); // aka. not found
  }


  getById(id: number): Block
  {
    // NOTE: read does increase the cusor
    const oldIdxPos = this.idxPos;
    const oldDbPos = this.dbPos;

    let currentAt = 0;
    let skipThisManyBytesInDb = 0;  // first entry

    Deno.seekSync(this.bcidx.rid, 0, Deno.SeekMode.Start); // seek to start (temporarily! seek to end at the end of this function)

    while (1)
    {
      //console.log("currentAt: " + currentAt);


      // read the index identifier 
      const idxIdBuf = new Uint8Array(4); // read 4 bytes aka. 32 bits
      let actualReadBytes = Deno.readSync(this.bcidx.rid, idxIdBuf);

      if (actualReadBytes !== 4)
        break;

      const idxIdView = new DataView(idxIdBuf.buffer, 0);
      const _id: number = idxIdView.getUint32(0, true); // little-endian

          
      // get the db data size from this index (to know how many bytes to skip)
      const sizeBuffer = new Uint8Array(4);
      actualReadBytes = Deno.readSync(this.bcidx.rid, sizeBuffer);

      if (actualReadBytes !== 4)
        break;

      const sizeView = new DataView(sizeBuffer.buffer, 0);
      const dbSize = sizeView.getUint32(0, true);
      //console.log("("+currentAt+") dbSize = " + dbSize);


      if (id == _id) // if this is the wanted index by position
      {
        // get data from db
        const dbPos = Deno.seekSync(this.bcdb.rid, skipThisManyBytesInDb, Deno.SeekMode.Start); // go to index position in db

        if (dbPos != skipThisManyBytesInDb)
          break;

        const dbBuf = new Uint8Array(dbSize);
        actualReadBytes = Deno.readSync(this.bcdb.rid, dbBuf);

        if (actualReadBytes !== dbSize)
          break;

        
        // reset file cursors to the state before call of this function
        Deno.seekSync(this.bcidx.rid, oldIdxPos, Deno.SeekMode.Start);
        Deno.seekSync(this.bcdb.rid, oldDbPos, Deno.SeekMode.Start);
    
        //console.log("get: found, done!");
        return new Block(_id, dbBuf);
      }


      // tell the next index to skip bytes in db
      skipThisManyBytesInDb += dbSize;


      // if not found yet ... skip this index
      currentAt++;
    }

    
    // reset file cursors to the state before call of this function
    Deno.seekSync(this.bcidx.rid, oldIdxPos, Deno.SeekMode.Start);
    Deno.seekSync(this.bcdb.rid, oldDbPos, Deno.SeekMode.Start);
    throw("out of bounds"); // aka. not found
  }
}