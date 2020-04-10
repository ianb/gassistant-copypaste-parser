function parseControl(options) {
  var inputText = options.inputText;
  var values = parseText(inputText);
  var element = createController(values, function onSubmit(values) {
    options.onOutputText(serialize(values));
  });
  options.controlContainer.innerHTML = "";
  options.controlContainer.appendChild(element);
}

var months = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

var dateRegex = /today|yesterday|\d\d?\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i;
var yearRegex = /\d{4}/;
var timeRegex = /^\s*(\d\d:\d\d)\s*(am|pm)?/i;

function parseText(text) {
  var now = new Date();
  var activeYear = now.getFullYear();
  var activeDay = null;
  var activeMonth = null;
  var lines = text.split("\n");
  var values = [];
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var match = dateRegex.exec(line);
    if (match) {
      // It's a date header
      var yearMatch = yearRegex.exec(line);
      if (yearMatch) {
        activeYear = parseInt(yearMatch[0], 10);
      }
      if (match[0].toLowerCase() === "today") {
        activeDay = now.getDate();
        activeMonth = now.getMonth() + 1;
      } else if (match[0].toLowerCase() === "yesterday") {
        var yesterday = new Date(Date.now() - 1000 * 60 * 60 * 24);
        activeDay = yesterday.getDate();
        activeMonth = yesterday.getMonth() + 1;
      } else {
        var parts = match[0].split(/\s+/);
        activeDay = parseInt(parts[0], 10);
        activeMonth = months[parts[1].toLowerCase()];
      }
      continue;
    }
    if (/^\s*said\s+/i.test(line)) {
      // It's an utterance
      var utterance = line.replace(/^\s*said\s+/i, "").replace(/\s*$/, "");
      values.push({
        utterance: utterance,
        year: activeYear,
        month: activeMonth,
        day: activeDay,
      });
      continue;
    }
    var timeMatch = timeRegex.exec(line);
    if (timeMatch) {
      if (!values.length) {
        // Somehow appeared before any utterances
        continue;
      }
      var time = timeMatch[1] + (timeMatch[2] || "");
      var last = values[values.length - 1];
      if (!last.time) {
        last.time = time;
      }
      var hasLocation = false;
      var hasAudio = false;
      // The details also appear on this line
      if (line.indexOf("\ue0c8") != -1) {
        // This is the location icon
        hasLocation = true;
      }
      if (line.indexOf("\ue31d")) {
        // The audio icon
        hasAudio = true;
      }
      if (!last.metadata) {
        last.metadata = {
          hasLocation: hasLocation,
          hasAudio: hasAudio,
        };
      }
    }
  }
  return values;
}

function make(tag, attrs, children) {
  var el = document.createElement(tag);
  if (attrs) {
    for (var name in attrs) {
      el.setAttribute(name, attrs[name]);
    }
  }
  if (children) {
    for (var i = 0; i < children.length; i++) {
      el.appendChild(children[i]);
    }
  }
  return el;
}

function text(t) {
  return document.createTextNode(t);
}

function findParent(node, tagName) {
  while (node && node.tagName !== tagName.toUpperCase()) {
    node = node.parentNode;
  }
  return node;
}

function createController(values, onSubmit) {
  var button1 = make("button", null, [text("I'm done selecting")]);
  var button2 = button1.cloneNode(true);
  var div = make("div", null, [
    make("style", null, [
      text(
        "#gassistant-parser tr:hover td {background-color: rgba(0, 0, 0, 0.1)}"
      ),
    ]),
    make("h3", null, [text("Your history:")]),
    make("p", null, [text("Click on any items you'd like to remove")]),
    button1,
  ]);
  var table = make("table", {
    cellspacing: "0",
    id: "gassistant-parser",
    border: "1",
  });
  div.appendChild(table);
  var removed = {};
  function checkElement(event) {
    var tr = findParent(event.target, "tr");
    var index = parseInt(tr.getAttribute("data-index"), 10);
    if (removed[index]) {
      delete removed[index];
      tr.childNodes[0].childNodes[0].checked = false;
      tr.childNodes[1].style.textDecoration = null;
    } else {
      removed[index] = true;
      tr.childNodes[0].childNodes[0].checked = true;
      tr.childNodes[1].style.textDecoration = "line-through";
    }
  }
  for (var i = 0; i < values.length; i++) {
    var value = values[i];
    var checkTd = make("td", null, [make("input", { type: "checkbox" })]);
    checkTd.addEventListener("click", checkElement);
    var utteranceTd = make("td", null, [text(value.utterance)]);
    utteranceTd.addEventListener("click", checkElement);
    var tr = make("tr", { "data-index": i }, [checkTd, utteranceTd]);
    table.appendChild(tr);
  }
  function clickButton() {
    var selected = [];
    for (var i = 0; i < values.length; i++) {
      if (removed[i]) {
        continue;
      }
      selected.push(values[i]);
    }
    onSubmit(selected);
  }
  button1.addEventListener("click", clickButton);
  button2.addEventListener("click", clickButton);
  div.appendChild(button2);
  return div;
}

function twoDigit(n) {
  if (!n) {
    return "??";
  }
  if (n < 10) {
    return "0" + n;
  }
  return String(n);
}

function serialize(values) {
  var lines = [];
  for (var i = 0; i < values.length; i++) {
    var v = values[i];
    lines.push(
      String(v.year || "????") +
        "-" +
        twoDigit(v.month) +
        "-" +
        twoDigit(v.day) +
        "T" +
        (v.time || "??:??") +
        " " +
        (v.metadata && v.metadata.hasLocation ? "L" : "l") +
        (v.metadata && v.metadata.hasAudio ? "A" : "a") +
        " " +
        v.utterance
    );
  }
  return lines.join("\n");
}
