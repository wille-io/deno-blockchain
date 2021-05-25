import { Blockchain } from "./mod.ts"
import { assertEquals } from "https://deno.land/std/testing/asserts.ts";


const bc = new Blockchain(".", { read: true, write: true, truncate: true, create: true });


Deno.test(
{
  name: "Add test blocks",
  fn: () => 
  {
    bc.append(1234, new TextEncoder().encode("Test123!"));
    bc.append(5678, new TextEncoder().encode("Test456!"));
    bc.append(9012, new TextEncoder().encode("Test789!"));
  },
});


Deno.test(
{
  name: "Get existing blocks",
  fn: () => 
  {
    (new TextDecoder().decode(bc.getByIndex(0).data));
    (new TextDecoder().decode(bc.getByIndex(2).data));
    (new TextDecoder().decode(bc.getById(1234).data));
    (new TextDecoder().decode(bc.getById(9012).data));
  },
});


Deno.test(
{
  name: "Get non-existing block #1",
  fn: () => 
  {
    try { console.log(new TextDecoder().decode(bc.getByIndex(5).data)); } catch (e) { return; } throw("Test didn't fail!");
  },
});


Deno.test(
{
  name: "Get non-existing block #2",
  fn: () => 
  {
    try { console.log(new TextDecoder().decode(bc.getByIndex(12).data)); } catch (e) { return; } throw("Test didn't fail!");
  },
});

Deno.test(
{
  name: "Get non-existing block #3",
  fn: () => 
  {
    try { console.log(new TextDecoder().decode(bc.getById(666).data)); } catch (e) { return; } throw("Test didn't fail!");
  },
});

Deno.test(
{
  name: "Get non-existing block #4",
  fn: () => 
  {
    try { console.log(new TextDecoder().decode(bc.getById(1337).data)); } catch (e) { return; } throw("Test didn't fail!");
  },
});

Deno.test(
{
  name: "Has index by existing id",
  fn: () => 
  {
    assertEquals(bc.hasIndexById(1234), true);
  },
});

Deno.test(
{
  name: "Has index by existing id",
  fn: () => 
  {
    assertEquals(bc.hasIndexById(9012), true);
  },
});

Deno.test(
{
  name: "Has index by non-existing id",
  fn: () => 
  {
    assertEquals(bc.hasIndexById(666), false);
  },
});

Deno.test(
{
  name: "Has index by non-existing id",
  fn: () => 
  {
    assertEquals(bc.hasIndexById(1337), false);
  },
});