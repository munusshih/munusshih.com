document.getElementById("emailButton").addEventListener("click", function () {
  const input = document.createElement("input");
  input.value = "munusshih@gmail.com"; // Set the value to the email
  document.body.appendChild(input);

  input.select();
  input.setSelectionRange(0, 99999); // For mobile devices

  document.execCommand("copy");
  document.body.removeChild(input);

  const message = document.getElementById("copyMessage");
  message.style.display = "block";
});
