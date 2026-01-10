import orjson

from zerver.actions.user_groups import bulk_add_members_to_user_groups, check_add_user_group
from zerver.lib.test_classes import ZulipTestCase
from zerver.models import Message, UserMessage


class WhisperMessageTest(ZulipTestCase):
    """Tests for whispered messages - messages with visibility restricted to specific users/groups."""

    def test_send_whisper_to_user(self) -> None:
        """Test sending a whispered message to a specific user."""
        sender = self.example_user("hamlet")
        recipient = self.example_user("cordelia")
        other_user = self.example_user("othello")

        # All users should be subscribed to the stream
        stream_name = "Verona"
        self.subscribe(sender, stream_name)
        self.subscribe(recipient, stream_name)
        self.subscribe(other_user, stream_name)

        self.login_user(sender)
        result = self.client_post(
            "/json/messages",
            {
                "type": "stream",
                "to": orjson.dumps(stream_name).decode(),
                "content": "This is a whispered message",
                "topic": "whisper test",
                "whisper_to_user_ids": orjson.dumps([recipient.id]).decode(),
            },
        )
        self.assert_json_success(result)
        message_id = orjson.loads(result.content)["id"]

        # Sender should have UserMessage
        self.assertTrue(
            UserMessage.objects.filter(user_profile=sender, message_id=message_id).exists()
        )

        # Recipient should have UserMessage
        self.assertTrue(
            UserMessage.objects.filter(user_profile=recipient, message_id=message_id).exists()
        )

        # Other user should NOT have UserMessage
        self.assertFalse(
            UserMessage.objects.filter(user_profile=other_user, message_id=message_id).exists()
        )

    def test_send_whisper_to_multiple_users(self) -> None:
        """Test sending a whispered message to multiple users."""
        sender = self.example_user("hamlet")
        recipient1 = self.example_user("cordelia")
        recipient2 = self.example_user("iago")
        other_user = self.example_user("othello")

        stream_name = "Verona"
        for user in [sender, recipient1, recipient2, other_user]:
            self.subscribe(user, stream_name)

        self.login_user(sender)
        result = self.client_post(
            "/json/messages",
            {
                "type": "stream",
                "to": orjson.dumps(stream_name).decode(),
                "content": "Whisper to multiple users",
                "topic": "whisper test",
                "whisper_to_user_ids": orjson.dumps([recipient1.id, recipient2.id]).decode(),
            },
        )
        self.assert_json_success(result)
        message_id = orjson.loads(result.content)["id"]

        # Sender and both recipients should have UserMessage
        for user in [sender, recipient1, recipient2]:
            self.assertTrue(
                UserMessage.objects.filter(user_profile=user, message_id=message_id).exists(),
                f"{user.email} should have received the whisper",
            )

        # Other user should NOT have UserMessage
        self.assertFalse(
            UserMessage.objects.filter(user_profile=other_user, message_id=message_id).exists()
        )

    def test_send_whisper_to_group(self) -> None:
        """Test sending a whispered message to a user group."""
        sender = self.example_user("hamlet")
        member1 = self.example_user("cordelia")
        member2 = self.example_user("iago")
        non_member = self.example_user("othello")

        stream_name = "Verona"
        for user in [sender, member1, member2, non_member]:
            self.subscribe(user, stream_name)

        # Create a user group with member1 and member2
        realm = sender.realm
        user_group = check_add_user_group(
            realm, "whisper_test_group", [member1, member2], acting_user=sender
        )

        self.login_user(sender)
        result = self.client_post(
            "/json/messages",
            {
                "type": "stream",
                "to": orjson.dumps(stream_name).decode(),
                "content": "Whisper to a group",
                "topic": "whisper test",
                "whisper_to_group_ids": orjson.dumps([user_group.id]).decode(),
            },
        )
        self.assert_json_success(result)
        message_id = orjson.loads(result.content)["id"]

        # Sender and group members should have UserMessage
        for user in [sender, member1, member2]:
            self.assertTrue(
                UserMessage.objects.filter(user_profile=user, message_id=message_id).exists(),
                f"{user.email} should have received the whisper",
            )

        # Non-member should NOT have UserMessage
        self.assertFalse(
            UserMessage.objects.filter(user_profile=non_member, message_id=message_id).exists()
        )

    def test_send_whisper_to_users_and_groups(self) -> None:
        """Test sending a whispered message to both users and groups."""
        sender = self.example_user("hamlet")
        direct_recipient = self.example_user("cordelia")
        group_member = self.example_user("iago")
        non_recipient = self.example_user("othello")

        stream_name = "Verona"
        for user in [sender, direct_recipient, group_member, non_recipient]:
            self.subscribe(user, stream_name)

        # Create a user group with group_member
        realm = sender.realm
        user_group = check_add_user_group(
            realm, "whisper_combo_group", [group_member], acting_user=sender
        )

        self.login_user(sender)
        result = self.client_post(
            "/json/messages",
            {
                "type": "stream",
                "to": orjson.dumps(stream_name).decode(),
                "content": "Whisper to users and groups",
                "topic": "whisper test",
                "whisper_to_user_ids": orjson.dumps([direct_recipient.id]).decode(),
                "whisper_to_group_ids": orjson.dumps([user_group.id]).decode(),
            },
        )
        self.assert_json_success(result)
        message_id = orjson.loads(result.content)["id"]

        # Sender, direct recipient, and group member should have UserMessage
        for user in [sender, direct_recipient, group_member]:
            self.assertTrue(
                UserMessage.objects.filter(user_profile=user, message_id=message_id).exists(),
                f"{user.email} should have received the whisper",
            )

        # Non-recipient should NOT have UserMessage
        self.assertFalse(
            UserMessage.objects.filter(user_profile=non_recipient, message_id=message_id).exists()
        )

    def test_whisper_metadata_in_message(self) -> None:
        """Test that whisper_recipients is stored in the message."""
        sender = self.example_user("hamlet")
        recipient = self.example_user("cordelia")

        stream_name = "Verona"
        self.subscribe(sender, stream_name)
        self.subscribe(recipient, stream_name)

        self.login_user(sender)
        result = self.client_post(
            "/json/messages",
            {
                "type": "stream",
                "to": orjson.dumps(stream_name).decode(),
                "content": "Whisper with metadata check",
                "topic": "whisper test",
                "whisper_to_user_ids": orjson.dumps([recipient.id]).decode(),
            },
        )
        self.assert_json_success(result)
        message_id = orjson.loads(result.content)["id"]

        message = Message.objects.get(id=message_id)
        self.assertIsNotNone(message.whisper_recipients)
        self.assertIn("user_ids", message.whisper_recipients)
        self.assertEqual(message.whisper_recipients["user_ids"], [recipient.id])

    def test_sender_always_receives_own_whisper(self) -> None:
        """Test that the sender always receives their own whispered message,
        even if they're not in the whisper recipient list."""
        sender = self.example_user("hamlet")
        recipient = self.example_user("cordelia")

        stream_name = "Verona"
        self.subscribe(sender, stream_name)
        self.subscribe(recipient, stream_name)

        self.login_user(sender)
        result = self.client_post(
            "/json/messages",
            {
                "type": "stream",
                "to": orjson.dumps(stream_name).decode(),
                "content": "Sender should see this",
                "topic": "whisper test",
                "whisper_to_user_ids": orjson.dumps([recipient.id]).decode(),
            },
        )
        self.assert_json_success(result)
        message_id = orjson.loads(result.content)["id"]

        # Sender should have UserMessage even though not in recipient list
        self.assertTrue(
            UserMessage.objects.filter(user_profile=sender, message_id=message_id).exists()
        )

    def test_whisper_not_allowed_for_dm(self) -> None:
        """Test that whisper parameters cause an error for direct messages."""
        sender = self.example_user("hamlet")
        dm_recipient = self.example_user("cordelia")
        whisper_recipient = self.example_user("othello")

        self.login_user(sender)
        result = self.client_post(
            "/json/messages",
            {
                "type": "private",
                "to": orjson.dumps([dm_recipient.id]).decode(),
                "content": "This is a DM, whisper should cause error",
                "whisper_to_user_ids": orjson.dumps([whisper_recipient.id]).decode(),
            },
        )
        self.assert_json_error(result, "Whispers can only be sent in channels")


class WhisperAccessTest(ZulipTestCase):
    """Tests for access control on whispered messages."""

    def test_non_recipient_cannot_access_whisper(self) -> None:
        """Test that users not in the whisper recipient list cannot access the message."""
        sender = self.example_user("hamlet")
        recipient = self.example_user("cordelia")
        non_recipient = self.example_user("othello")

        stream_name = "Verona"
        for user in [sender, recipient, non_recipient]:
            self.subscribe(user, stream_name)

        self.login_user(sender)
        result = self.client_post(
            "/json/messages",
            {
                "type": "stream",
                "to": orjson.dumps(stream_name).decode(),
                "content": "Secret whisper",
                "topic": "whisper test",
                "whisper_to_user_ids": orjson.dumps([recipient.id]).decode(),
            },
        )
        self.assert_json_success(result)
        message_id = orjson.loads(result.content)["id"]

        # Recipient can access the message
        self.login_user(recipient)
        result = self.client_get(f"/json/messages/{message_id}")
        self.assert_json_success(result)

        # Non-recipient cannot access the message
        self.login_user(non_recipient)
        result = self.client_get(f"/json/messages/{message_id}")
        self.assert_json_error(result, "Invalid message(s)")

    def test_whisper_filtered_from_narrow(self) -> None:
        """Test that whispered messages are filtered from narrows for non-recipients."""
        sender = self.example_user("hamlet")
        recipient = self.example_user("cordelia")
        non_recipient = self.example_user("othello")

        stream_name = "Verona"
        for user in [sender, recipient, non_recipient]:
            self.subscribe(user, stream_name)

        # Send a regular message
        self.login_user(sender)
        result = self.client_post(
            "/json/messages",
            {
                "type": "stream",
                "to": orjson.dumps(stream_name).decode(),
                "content": "Public message",
                "topic": "whisper test",
            },
        )
        self.assert_json_success(result)
        public_message_id = orjson.loads(result.content)["id"]

        # Send a whispered message
        result = self.client_post(
            "/json/messages",
            {
                "type": "stream",
                "to": orjson.dumps(stream_name).decode(),
                "content": "Whispered message",
                "topic": "whisper test",
                "whisper_to_user_ids": orjson.dumps([recipient.id]).decode(),
            },
        )
        self.assert_json_success(result)
        whisper_message_id = orjson.loads(result.content)["id"]

        # Verify sender has UserMessage for the whisper
        self.assertTrue(
            UserMessage.objects.filter(user_profile=sender, message_id=whisper_message_id).exists(),
            f"Sender should have UserMessage for whisper {whisper_message_id}",
        )

        # Sender should see both messages (sender always sees their whispers)
        narrow = orjson.dumps([{"operator": "channel", "operand": stream_name}]).decode()
        result = self.client_get(
            "/json/messages",
            {"narrow": narrow, "num_before": 0, "num_after": 10, "anchor": "oldest"},
        )
        self.assert_json_success(result)
        messages = orjson.loads(result.content)["messages"]
        message_ids = [m["id"] for m in messages]
        self.assertIn(public_message_id, message_ids, f"Public message {public_message_id} not in {message_ids}")
        self.assertIn(whisper_message_id, message_ids, f"Whisper message {whisper_message_id} not in {message_ids}")

        # Recipient should see both messages
        self.login_user(recipient)
        result = self.client_get(
            "/json/messages",
            {"narrow": narrow, "num_before": 0, "num_after": 10, "anchor": "oldest"},
        )
        self.assert_json_success(result)
        messages = orjson.loads(result.content)["messages"]
        message_ids = [m["id"] for m in messages]
        self.assertIn(public_message_id, message_ids)
        self.assertIn(whisper_message_id, message_ids)

        # Non-recipient should only see public message
        self.login_user(non_recipient)
        result = self.client_get(
            "/json/messages",
            {"narrow": narrow, "num_before": 0, "num_after": 10, "anchor": "oldest"},
        )
        self.assert_json_success(result)
        messages = orjson.loads(result.content)["messages"]
        message_ids = [m["id"] for m in messages]
        self.assertIn(public_message_id, message_ids)
        self.assertNotIn(whisper_message_id, message_ids)


class WhisperGroupDynamicAccessTest(ZulipTestCase):
    """Tests for dynamic group membership affecting whisper visibility."""

    def test_adding_user_to_group_grants_whisper_access(self) -> None:
        """Test that adding a user to a group grants them access to past whispers to that group."""
        sender = self.example_user("hamlet")
        existing_member = self.example_user("cordelia")
        new_member = self.example_user("othello")

        stream_name = "Verona"
        for user in [sender, existing_member, new_member]:
            self.subscribe(user, stream_name)

        # Create a user group with only existing_member
        realm = sender.realm
        user_group = check_add_user_group(
            realm, "dynamic_access_group", [existing_member], acting_user=sender
        )

        # Send a whisper to the group
        self.login_user(sender)
        result = self.client_post(
            "/json/messages",
            {
                "type": "stream",
                "to": orjson.dumps(stream_name).decode(),
                "content": "Whisper to group before new member joins",
                "topic": "whisper test",
                "whisper_to_group_ids": orjson.dumps([user_group.id]).decode(),
            },
        )
        self.assert_json_success(result)
        message_id = orjson.loads(result.content)["id"]

        # New member cannot access the message yet
        self.login_user(new_member)
        result = self.client_get(f"/json/messages/{message_id}")
        self.assert_json_error(result, "Invalid message(s)")

        # Add new_member to the group
        bulk_add_members_to_user_groups([user_group], [new_member.id], acting_user=sender)

        # Now new_member can access the message
        result = self.client_get(f"/json/messages/{message_id}")
        self.assert_json_success(result)
