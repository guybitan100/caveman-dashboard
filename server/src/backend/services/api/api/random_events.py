from model.types import EventType

# Probabilities that dictate how to distribute events totals if user specifies random quantity
event_type_to_weight = {
    EventType.AUDIO: 0.026944272773524385,
    EventType.CALENDAR_ENTRY: 0.008033778059093458,
    EventType.CALL: 0.017904579120129726,
    EventType.CARVED_STRING: 0.08833110186977366,
    EventType.CHAT: 0.23171214725154632,
    EventType.CONTACT: 0.031003714382103302,
    EventType.COOKIE: 0.029421772444486495,
    EventType.DOCUMENT: 0.05989746235556041,
    EventType.EMAIL: 0.028230869996553703,
    EventType.IMAGE: 0.22517613225398656,
    EventType.APP: 0.008067357450615154,
    EventType.INSTANT_MESSAGE: 0.07573672761057665,
    EventType.JOURNEY: 0.013555383125729948,
    EventType.LOCATION: 0.029303628736092973,
    EventType.NOTE: 0.008645250000578492,
    EventType.NOTIFICATION: 0.0129200222900151,
    EventType.PASSWORD: 0.021126872324414167,
    EventType.VIDEO: 0.015760872938590718,
    EventType.WEB_BOOKMARK: 0.015591234043966382,
    EventType.WEB_HISTORY: 0.0526368209726625
}

assert sum(event_type_to_weight.values()) == 1, "Event distribution weights must sum to 1"
