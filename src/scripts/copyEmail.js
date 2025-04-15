document.getElementById("emailButton").addEventListener("click", function () {
  const email = this.querySelector("a");

  navigator.clipboard
    .writeText(email.textContent)
    .then(() => {
      const originalText = email.textContent;
      email.textContent = "Copied!";

      setTimeout(() => {
        email.textContent = originalText;
      }, 2000);
    })
    .catch((err) => {
      console.error("Failed to copy text: ", err);
    });
});
