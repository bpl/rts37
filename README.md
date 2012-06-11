# rts37 #

This project represents my attempt to create an RTS in JavaScript. Turns out that writing an RTS is a lot of work, especially when you get to the AI and 3D graphics territory. I kind of knew this before I started ("RTS the second hardest genre to start with" --some wise person at some game development forum), but I was overly optimistic of how much time I would have to work on this.

I have shown this project to a couple of people and one thing that seems to impress them is use of [module loader](http://requirejs.org/) to organise code into manageable and easily navigable chunks. So I decided to go ahead and publish this project as an example of relatively well-organised JavaScript codebase.

## Status ##

What works:

*   3D graphics
*   Mouse input

What doesn't:

*   Pathfinding
*   Collision avoidance (there is collision handling, but it doesn't look good)
*   Network play (there is network option but it isn't guaranteed to work due to numerical consistency issues -- see below)
*   Any sort of gameplay (you can't destroy enemy units yet)

The next thing I'm planning to do is to integrate my pathfinding test with the code, integrate that with collision avoidance and tinker with things until they work correctly. After that, I want to get some skeletal animation going.

## Installation ##

*   `git clone`
*   Init submodules (`git submodule init` in the project root) if Git didn't do it automatically for you already
*   `npm install`
*   `cd dep/jquery && npm install && grunt` to build jQuery ([detailed instructions](https://github.com/jquery/jquery#how-to-build-your-own-jquery))

Start the development and network play server by:

```bash
cd src/server
node run-server.js
```

Then open [localhost:8000](http://localhost:8000/) in your favourite browser with WebSocket and WebGL support.

## Keyboard shortcuts ##

**x**: Fire at pointer location
**u**: Create new unit at pointer location
**w**, **a**, **s**, **d**: Pan the viewport
**e**, **f**: Zoom in and out

## Achieving numerical consistency in JavaScript ##

RTS games use [lock-step execution networking](http://www.gamasutra.com/view/feature/3094/1500_archers_on_a_288_network_.php) model. Each player has the exactly same copy of the state of the game world. The input from each player is shared with every other player, and based on this input, the the exact same set of transformations is applied to each player's copy of the game world. This allows the state of thousands of units to be kept in sync with very little bandwidth consumption.

For this approach to work, it's essential that upon receiving the input from the other players, the game performs the exact same processing on each machine it's being run on. Though [technically speaking](http://docs.oracle.com/cd/E19957-01/806-3568/ncg_goldberg.html) many IEEE 754 floating point number operations exactly defined, the IEEE 754 standard includes a fair number of operation modes (denormals supported or not, internal precision of operations, rounding mode, exception handling). To [achieve the consistency](http://www.yosefk.com/blog/consistency-how-to-defeat-the-purpose-of-ieee-floating-point.html) we need, all these modes must match. This is a [difficult task](http://hal.archives-ouvertes.fr/hal-00128124/en/) to achieve in practice, and that's why most RTS games use integer math for anything dealing with the state of the world.

JavaScript the language has only numeric type, *number*, which is defined to represent [double precision 64-bit IEEE 754 value](http://es5.github.com/#x8.5). JavaScript engines tend to internally represent some *number* values as 32-bit integers, but this is invisible to the programmer. Furthermore, the rounding behaviour is defined to exactly match IEEE 754 "round to nearest" mode, [denormal](http://en.wikipedia.org/wiki/Denormal_number) support is required and exceptions are to be handled by substituting the result with NaN (Not a Number) guard value.

As far as I can tell, the ECMAScript 5 specification doesn't explicitly mention the internal precision of operations. Maybe the lack of mention should be taken to mean that 64-bit internal precision is to be expected, maybe not. Another issue is that some ARM implementations of JavaScript engines are known to [not support denormals](https://mail.mozilla.org/pipermail/es-discuss/2012-May/022644.html). Finally, the spec [explicitly](http://es5.github.com/#x15.8.2) leaves the exact implementation of many trigonometric operations to the choice of the engine implementor.

I see only solutions to this issue:

*   Devise a set of tests to ensure that the implementation conforms to our expectations. Reject deviating implementations. Reimplement trigonometric operations in JavaScript.
*   Round the results of all mathematical operations that might produce non-integer values to integer values. Reimplement trigonometric operations in JavaScript.

I was planning to go with the second approach. My reasoning is that if there are JavaScript engines with higher than 64-bit internal precision, the fact that modern JavaScript engines like to keep values in registers but aren't guaranteed to do so at any given moment means any such engine not only is a no-go, but can't be reliably detected.

The "was planning" part means that I haven't paid much attention to this yet. For the network play option work correctly, it's currently necessary that both players use browsers with 64-bit internal precision and same implementation of trigonometric functions.

## Other RTS projects to look into ##

*   [Spring RTS](http://springrts.com/), written in C++, is to my knowledge the most technically advanced open source RTS in existence
*   [OpenRA](http://openra.res0l.net/) deserves praise for using C# language features to write very clean code that often reads more like pseudocode
*   [C&C HTML5](http://www.adityaravishankar.com/projects/games/command-and-conquer/) actually does implement a playable RTS with just JavaScript ([blog post](http://www.adityaravishankar.com/2011/11/command-and-conquer-programming-an-rts-game-in-html5-and-javascript/))